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
const NAME_RE = /[a-z][a-z0-9]*/iy;

// As existing content expects: everything up to the first "]" is the tag. With no
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

// Rewrites mis-nested tags so every tag closes inside its parent: an inner
// tag still open when its parent closes is closed there, and its own later
// close is dropped, so `[b][i]x[/b] y[/i]` reads `[b][i]x[/i][/b] y`. Tags
// that are never closed, and closes that match nothing, are left alone.
export function repairNesting(src, isKnown) {
  const literal = literalRanges(src, LITERAL_TAGS);
  const inLiteral = (pos) =>
    literal.some(([from, to]) => pos >= from && pos < to);

  const tags = [];
  const re = /\[(\/?)([a-z][a-z0-9]*)/gi;
  let match;
  while ((match = re.exec(src))) {
    const tag = match[2].toLowerCase();
    if (!isKnown(tag) || inLiteral(match.index)) {
      continue;
    }
    if (match[1]) {
      if (src[re.lastIndex] === "]") {
        tags.push({
          tag,
          closing: true,
          at: match.index,
          end: re.lastIndex + 1,
        });
      }
      continue;
    }
    const open = parseLooseTag(src, match.index, isKnown);
    if (open) {
      tags.push({ tag, closing: false, at: match.index });
      re.lastIndex = match.index + open.length;
    }
  }

  // closed at all, the way findClose pairs them: by name and depth
  const closed = new Set();
  const byName = {};
  for (const item of tags) {
    const openers = (byName[item.tag] ||= []);
    if (!item.closing) {
      openers.push(item);
    } else if (openers.length) {
      closed.add(openers.pop());
    }
  }

  const edits = [];
  const stack = [];
  const dropped = {};
  for (const item of tags) {
    if (!item.closing) {
      if (closed.has(item)) {
        stack.push(item);
      }
      continue;
    }
    const index = stack.findLastIndex((open) => open.tag === item.tag);
    if (index === -1) {
      if (dropped[item.tag] > 0) {
        dropped[item.tag]--;
        edits.push({ at: item.at, remove: item.end - item.at, insert: "" });
      }
      continue;
    }
    const inner = stack.splice(index).slice(1).reverse();
    if (inner.length) {
      edits.push({
        at: item.at,
        remove: 0,
        insert: inner.map((open) => `[/${open.tag}]`).join(""),
      });
      for (const open of inner) {
        dropped[open.tag] = (dropped[open.tag] || 0) + 1;
      }
    }
  }

  let out = src;
  for (const edit of edits.reverse()) {
    out =
      out.slice(0, edit.at) + edit.insert + out.slice(edit.at + edit.remove);
  }
  return out;
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

// A line markdown starts a block with: heading, list item, blockquote, fence,
// rule, setext underline, table delimiter row, or core's block bbcode
const MARKDOWN_BLOCK_RE =
  /^(?:#{1,6}(?:\s|$)|[-*+]\s|\d{1,9}[.)]\s|>|```|~~~|([-*_])(?:[ \t]*\1){2,}[ \t]*$|=+[ \t]*$|\|?[ \t]*:?-+:?[ \t]*\||\[(?:quote|details|poll|code)(?=[\]=\s]))/i;

// Whether a tag's content spans lines and has a line markdown reads as a
// block, so an inline tag around it must render it as blocks. The first line
// only counts when the tag starts its own line.
export function needsBlocks(content, startsLine) {
  const lines = content.split("\n");
  if (lines.length === 1) {
    return false;
  }
  const literal = literalRanges(content, LITERAL_TAGS);
  // a literal span's own opening line still counts (a fence or [code])
  const inLiteral = (pos) => literal.some(([a, b]) => pos > a && pos < b);
  let start = 0;
  return lines.some((line, index) => {
    const lineStart = start;
    start += line.length + 1;
    return (
      (index > 0 || startsLine) &&
      !inLiteral(lineStart) &&
      MARKDOWN_BLOCK_RE.test(line.trimStart())
    );
  });
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
  LITERAL_TAGS,
  literalRanges,
  restoreNewlines,
};
