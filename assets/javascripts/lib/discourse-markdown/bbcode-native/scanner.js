// Scans raw bbcode text for tag boundaries: the loose (unquoted, multi-line)
// attribute syntax existing content uses, matching close tags at the right
// depth, and the spans (code, and the "literal" tags) that must never be
// re-parsed as bbcode.

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

// Fenced code, core's [code] and the "literal" tags are all literal text at the
// same priority: none of them is re-parsed as bbcode, and none of them is aware
// of bbcode nested inside the others.
let literalTags = ["code"];
// literal regions by source text: several rules scan the same text within one
// cook. Kept small, as each entry holds its text.
const literalCache = new Map();
const LITERAL_CACHE_SIZE = 20;

export function setLiteralTags(tags) {
  literalTags = ["code", ...tags];
  literalCache.clear();
}

// Depth-aware search for the matching close tag. Returns null when the tag is
// never closed, so the caller refuses and the text is left untouched.
export function findClose(src, from, tag, isKnown, limit = src.length) {
  // text shown as a literal example (e.g. "[nobr]" inside [plain]) must not
  // count as a real occurrence of the tag being searched for
  const skip = literalTags.includes(tag) ? [] : literalRanges(src);
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
  const literal = literalRanges(src);
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
// Callers must not modify the ranges returned, as they are shared.
function literalRanges(src) {
  let ranges = literalCache.get(src);
  if (!ranges) {
    ranges = findLiteralRanges(src);
    if (literalCache.size >= LITERAL_CACHE_SIZE) {
      literalCache.delete(literalCache.keys().next().value);
    }
    literalCache.set(src, ranges);
  }
  return ranges;
}

function findLiteralRanges(src) {
  const ranges = fenceRanges(src);
  const covered = (pos) => ranges.some(([from, to]) => pos >= from && pos < to);

  const blockRe = new RegExp(
    `\\[(${literalTags.join("|")})(?=[\\]=\\s])[^\\]]*\\]`,
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

// markdown-it reads a setext underline from the line above it, so it isn't
// one of the rules that interrupt a paragraph
const SETEXT_RE = /^ {0,3}(?:=+|-+)[ \t]*$/;

// Whether a tag's content spans lines and has a line markdown reads as a
// block, so an inline tag around it must render it as blocks. `rules` are the
// block rules that can end a paragraph, run as markdown-it runs them, so
// blocks other plugins add count too. The first line only counts when the tag
// starts its own line.
export function needsBlocks(content, startsLine, parent, rules) {
  if (!content.includes("\n")) {
    return false;
  }
  const literal = literalRanges(content);
  // a literal span's own opening line still counts (a fence or [code])
  const inLiteral = (pos) => literal.some(([a, b]) => pos > a && pos < b);
  const state = new parent.md.block.State(content, parent.md, parent.env, []);
  for (let line = startsLine ? 0 : 1; line < state.lineMax; line++) {
    if (state.isEmpty(line) || inLiteral(state.bMarks[line])) {
      continue;
    }
    // everything before the first block found is paragraph text
    const afterText = line > 0 && !state.isEmpty(line - 1);
    const text = content.slice(state.bMarks[line], state.eMarks[line]);
    if (afterText && SETEXT_RE.test(text)) {
      return true;
    }
    state.parentType = afterText ? "paragraph" : "root";
    state.line = line;
    if (rules.some((rule) => rule(state, line, state.lineMax, true))) {
      return true;
    }
  }
  return false;
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
  literalRanges,
  restoreNewlines,
};
