// Scans raw bbcode text for tag boundaries: the loose (unquoted, multi-line)
// attribute syntax existing content uses, matching close tags at the right
// depth, and the spans (fenced code, [code], [icode], [plain]) that must
// never be re-parsed as bbcode.

// stands in for a newline inside spans that must stay in one paragraph, so
// blank lines don't split them before the inline rule sees them
const NEWLINE_SENTINEL = String.fromCharCode(0xe000);
// the same, inside [nobr], where newlines must not become line breaks
const NOBR_SENTINEL = String.fromCharCode(0xe001);
// marks a line that ends with a newline the flatten pass added, not the author
const PHANTOM = String.fromCharCode(0xe002);
// BBob renders this in place of a delegated tag's content
const CONTENT_PLACEHOLDER = "BBCODECONTENTXX";
const NAME_RE = /[a-z][a-z0-9]*/iy;

// Mirrors BBob's lexer: everything up to the first "]" is the tag. With no
// whitespace before the first "=" the remainder is one raw value (this is what
// lets [div=height:auto; width:100%] work); otherwise it is key=value pairs.
export function parseLooseTag(src, pos, isKnown) {
  if (src.charCodeAt(pos) !== 0x5b) {
    return null;
  }
  const closing = src.charCodeAt(pos + 1) === 0x2f;
  const nameStart = pos + (closing ? 2 : 1);
  NAME_RE.lastIndex = nameStart;
  const nameMatch = NAME_RE.exec(src);
  if (!nameMatch) {
    return null;
  }
  const tag = nameMatch[0].toLowerCase();
  if (!isKnown(tag)) {
    return null;
  }
  const afterName = nameStart + nameMatch[0].length;
  const next = src[afterName];

  if (closing) {
    return next === "]"
      ? { tag, closing: true, length: afterName + 1 - pos }
      : null;
  }
  if (next === "]") {
    return {
      tag,
      closing: false,
      attrs: {},
      length: afterName + 1 - pos,
      raw: src.slice(pos, afterName + 1),
    };
  }
  if (next !== "=" && !/\s/.test(next || "")) {
    return null;
  }

  const end = src.indexOf("]", afterName);
  if (end === -1) {
    return null;
  }
  // the flatten pass may have swapped newlines in the attribute value
  const raw = restoreNewlines(src.slice(pos, end + 1));
  const tagStr = raw.slice(1, -1);
  if (tagStr.includes("[")) {
    return null;
  }
  const eq = tagStr.indexOf("=");
  if (eq === -1) {
    return null;
  }

  const attrs = {};
  if (!/\s/.test(tagStr.slice(0, eq).trim())) {
    let value = tagStr.slice(eq + 1).trim();
    const quote = value[0];
    if (
      (quote === '"' || quote === "'") &&
      value.length > 1 &&
      value.endsWith(quote)
    ) {
      value = value.slice(1, -1);
    }
    attrs._default = value;
  } else {
    const attrRe = /([-\w]+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;
    const rest = tagStr.slice(nameMatch[0].length);
    let attr;
    while ((attr = attrRe.exec(rest))) {
      attrs[attr[1]] = (attr[2] ?? attr[3] ?? attr[4] ?? "").trim();
    }
    // bare flags such as `open`
    for (const flag of rest.replace(attrRe, " ").split(/\s+/)) {
      if (/^[-\w]+$/.test(flag)) {
        attrs[flag] = flag;
      }
    }
  }
  return { tag, closing: false, attrs, length: end - pos + 1, raw };
}

// Depth-aware search for the matching close tag. Returns null when the tag is
// never closed, so the caller refuses and the text is left untouched.
// Fenced code, [code], [icode] and [plain] are all literal text at the same
// priority: none of them is re-parsed as bbcode, and none of them is aware
// of bbcode nested inside the others.
const LITERAL_TAGS = ["code", "icode", "plain"];

export function findClose(src, from, tag, isKnown, limit = src.length) {
  // text shown as a literal example (e.g. "[nobr]" inside [plain]) must not
  // count as a real occurrence of the tag being searched for
  const skip = LITERAL_TAGS.includes(tag)
    ? []
    : literalRanges(src, LITERAL_TAGS);
  const inSkip = (pos) => skip.some(([from2, to]) => pos >= from2 && pos < to);
  const re = new RegExp(`\\[(/?)${tag}(?![a-z0-9])`, "gi");
  re.lastIndex = from;
  let depth = 1;
  let match;
  while ((match = re.exec(src))) {
    if (match.index >= limit) {
      return null;
    }
    if (inSkip(match.index)) {
      continue;
    }
    if (match[1]) {
      if (src[match.index + match[0].length] !== "]") {
        continue;
      }
      if (--depth === 0) {
        return { start: match.index, end: match.index + match[0].length + 1 };
      }
    } else {
      const open = parseLooseTag(src, match.index, isKnown);
      if (open) {
        depth++;
        re.lastIndex = match.index + open.length;
      }
    }
  }
  return null;
}

function fenceRanges(src) {
  const ranges = [];
  const lineRe = /^ {0,3}(`{3,}|~{3,})([^\n]*)$/gm;
  let open = null;
  let match;
  while ((match = lineRe.exec(src))) {
    const [line, marker, rest] = match;
    if (!open) {
      if (marker[0] !== "`" || !rest.includes("`")) {
        open = { start: match.index, marker };
      }
    } else if (
      marker[0] === open.marker[0] &&
      marker.length >= open.marker.length &&
      !rest.trim()
    ) {
      ranges.push([open.start, match.index + line.length]);
      open = null;
    }
  }
  if (open) {
    ranges.push([open.start, src.length]);
  }
  return ranges;
}

// Text that is shown as written: tags inside it must not be looked at at all.
function literalRanges(src, tags = ["code"]) {
  const ranges = fenceRanges(src);
  const covered = (pos) => ranges.some(([from, to]) => pos >= from && pos < to);

  const blockRe = new RegExp(
    `\\[(${tags.join("|")})(?=[\\]=\\s])[^\\]]*\\]`,
    "gi"
  );
  let match;
  while ((match = blockRe.exec(src))) {
    if (covered(match.index)) {
      continue;
    }
    const closeRe = new RegExp(`\\[/${match[1]}\\]`, "gi");
    closeRe.lastIndex = blockRe.lastIndex;
    const close = closeRe.exec(src);
    if (close) {
      ranges.push([match.index, close.index + close[0].length]);
      blockRe.lastIndex = closeRe.lastIndex;
    }
  }

  const spanRe = /(?<!`)(`+)(?!`)(?:(?!\n[ \t]*\n)[\s\S])*?(?<!`)\1(?!`)/g;
  while ((match = spanRe.exec(src))) {
    if (!covered(match.index)) {
      ranges.push([match.index, match.index + match[0].length]);
    }
  }
  return ranges;
}

function restoreNewlines(text) {
  return text
    .replaceAll(PHANTOM + "\n", "")
    .replaceAll(NEWLINE_SENTINEL, "\n")
    .replaceAll(NOBR_SENTINEL, "\n")
    .replaceAll(PHANTOM, "");
}

export {
  NEWLINE_SENTINEL,
  NOBR_SENTINEL,
  PHANTOM,
  CONTENT_PLACEHOLDER,
  LITERAL_TAGS,
  literalRanges,
  restoreNewlines,
};
