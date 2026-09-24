// Finds tags in raw text: their boundaries, their matching closes, and the
// literal regions no tag is read in.

// Private-use characters, which real text doesn't contain.
// a newline inside a span that must stay one paragraph
const NEWLINE_SENTINEL = String.fromCharCode(0xe000);
// the same inside [nobr], where it isn't a line break
const NOBR_SENTINEL = String.fromCharCode(0xe001);
// ends a line whose newline the flatten pass added, not the author
const PHANTOM = String.fromCharCode(0xe002);
const NAME_RE = /[a-z][a-z0-9]*/iy;

// Everything up to the first "]" is the tag. With no whitespace before the
// first "=", the rest is one raw value ([div=height:auto; width:100%]);
// otherwise it is key=value pairs.
export function parseLooseTag(src, pos, isKnown, lengthOnly = false) {
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
    return { tag, closing: false, attrs: {}, length: afterName + 1 - pos };
  }
  if (next !== "=" && !/\s/.test(next || "")) {
    return null;
  }

  const end = src.indexOf("]", afterName);
  if (end === -1) {
    return null;
  }
  const inner = src.slice(pos + 1, end);
  if (inner.includes("[") || !inner.includes("=")) {
    return null;
  }
  if (lengthOnly) {
    return { tag, closing: false, length: end - pos + 1 };
  }
  // the flatten pass may have swapped newlines in the attribute value
  const raw = restoreNewlines(src.slice(pos, end + 1));
  const tagStr = raw.slice(1, -1);
  const eq = tagStr.indexOf("=");

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
  return { tag, closing: false, attrs, length: end - pos + 1 };
}

// with fenced code, never read as bbcode
let literalTags = ["code"];
// Results per source text: several rules scan the same text in one cook, and
// markdown-it checks the same lines many times. Emptied per cook.
const textCache = new Map();
const TEXT_CACHE_SIZE = 20;
const closeRes = new Map();
const literalCloseRes = new Map();

export function setLiteralTags(tags) {
  literalTags = ["code", ...tags];
  textCache.clear();
}

export function resetTextCache() {
  textCache.clear();
}

// The matching close, counting nested tags of the same name; null when never
// closed, which leaves the tag as text.
export function findClose(src, from, tag, isKnown, limit = src.length) {
  // only isKnown(tag) affects the result
  const close = memoFor(src, `close:${tag}:${from}:${isKnown(tag)}`, () =>
    scanForClose(src, from, tag, isKnown)
  );
  return close && close.start < limit ? close : null;
}

export function memoFor(src, key, compute) {
  const memo = cachedFor(src).memo;
  let value = memo.get(key);
  if (value === undefined) {
    value = compute();
    memo.set(key, value);
  }
  return value;
}

function scanForClose(src, from, tag, isKnown) {
  // a "[nobr]" shown inside [plain] isn't a real one
  const skip = literalTags.includes(tag) ? [] : literalRanges(src);
  const inSkip = (pos) => covers(skip, pos);
  let re = closeRes.get(tag);
  if (!re) {
    re = new RegExp(`\\[(/?)${tag}(?![a-z0-9])`, "gi");
    closeRes.set(tag, re);
  }
  re.lastIndex = from;
  let depth = 1;
  let match;
  while ((match = re.exec(src))) {
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
      const open = parseLooseTag(src, match.index, isKnown, true);
      if (open) {
        depth++;
        re.lastIndex = match.index + open.length;
      }
    }
  }
  return null;
}

// An inner tag still open when its parent closes is closed there and its own
// close dropped: `[b][i]x[/b] y[/i]` reads `[b][i]x[/i][/b] y`. Unclosed tags
// and unmatched closes are left alone.
export function repairNesting(src, isKnown) {
  const literal = literalRanges(src);
  const inLiteral = (pos) => covers(literal, pos);

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
    const open = parseLooseTag(src, match.index, isKnown, true);
    if (open) {
      tags.push({ tag, closing: false, at: match.index });
      re.lastIndex = match.index + open.length;
    }
  }

  // paired as findClose pairs them: by name and depth
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

  return applyEdits(src, edits);
}

// Edits at the same position go in the reverse of the order they were added.
export function applyEdits(src, edits) {
  const parts = [];
  let pos = 0;
  for (const edit of edits.reverse().sort((a, b) => a.at - b.at)) {
    parts.push(src.slice(pos, edit.at), edit.insert);
    pos = Math.max(pos, edit.at + edit.remove);
  }
  parts.push(src.slice(pos));
  return parts.join("");
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

// Shared: callers must not modify the ranges.
function literalRanges(src) {
  const entry = cachedFor(src);
  entry.ranges ??= findLiteralRanges(src);
  return entry.ranges;
}

function cachedFor(src) {
  let entry = textCache.get(src);
  if (entry) {
    // most recently used last, so the post outlives the tag contents
    textCache.delete(src);
  } else {
    entry = { ranges: null, memo: new Map() };
    if (textCache.size >= TEXT_CACHE_SIZE) {
      textCache.delete(textCache.keys().next().value);
    }
  }
  textCache.set(src, entry);
  return entry;
}

// Matches of one kind never overlap, so only earlier kinds can cover a match.
function findLiteralRanges(src) {
  const fences = indexRanges(fenceRanges(src));

  const blocks = [];
  const blockRe = new RegExp(
    `\\[(${literalTags.join("|")})(?=[\\]=\\s])[^\\]]*\\]`,
    "gi"
  );
  let match;
  while ((match = blockRe.exec(src))) {
    if (covers(fences, match.index)) {
      continue;
    }
    const tag = match[1].toLowerCase();
    let closeRe = literalCloseRes.get(tag);
    if (!closeRe) {
      closeRe = new RegExp(`\\[/${tag}\\]`, "gi");
      literalCloseRes.set(tag, closeRe);
    }
    closeRe.lastIndex = blockRe.lastIndex;
    const close = closeRe.exec(src);
    if (close) {
      blocks.push([match.index, close.index + close[0].length]);
      blockRe.lastIndex = closeRe.lastIndex;
    }
  }
  const covered = indexRanges([...fences, ...blocks]);

  const spans = [];
  const spanRe = /(?<!`)(`+)(?!`)(?:(?!\n[ \t]*\n)[\s\S])*?(?<!`)\1(?!`)/g;
  while ((match = spanRe.exec(src))) {
    if (!covers(covered, match.index)) {
      spans.push([match.index, match.index + match[0].length]);
    }
  }
  return indexRanges([...covered, ...spans]);
}

// covers() needs ranges sorted by start, with the furthest end so far
function indexRanges(ranges) {
  ranges.sort((a, b) => a[0] - b[0]);
  let furthest = -1;
  ranges.furthest = ranges.map(([, to]) => (furthest = Math.max(furthest, to)));
  return ranges;
}

// for ranges added in order of their start
function rangeList() {
  return Object.assign([], { furthest: [] });
}

function addRange(ranges, range) {
  ranges.push(range);
  ranges.furthest.push(Math.max(ranges.furthest.at(-1) ?? -1, range[1]));
}

// `strictly` leaves out each range's first character, a literal tag's opener
function covers(ranges, pos, strictly = false) {
  let low = 0;
  let high = ranges.length - 1;
  let last = -1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const from = ranges[mid][0];
    if (strictly ? from < pos : from <= pos) {
      last = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return last !== -1 && ranges.furthest[last] > pos;
}

// not among the rules that end a paragraph: markdown-it reads it from above
const SETEXT_RE = /^ {0,3}(?:=+|-+)[ \t]*$/;

// Whether an inline tag's content has a line markdown reads as a block, asked
// of the rules that can end a paragraph (`rules`), so other plugins' blocks
// count. The first line counts only when the tag starts its own line.
export function needsBlocks(content, startsLine, parent, rules) {
  if (!content.includes("\n")) {
    return false;
  }
  const literal = literalRanges(content);
  // a fence or [code]'s own opening line still counts
  const inLiteral = (pos) => covers(literal, pos, true);
  const state = new parent.md.block.State(content, parent.md, parent.env, []);
  for (let line = startsLine ? 0 : 1; line < state.lineMax; line++) {
    if (state.isEmpty(line) || inLiteral(state.bMarks[line])) {
      continue;
    }
    // everything before the first block is paragraph text
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

const MARKER_RE = new RegExp(`[${NEWLINE_SENTINEL}${NOBR_SENTINEL}${PHANTOM}]`);

function restoreNewlines(text) {
  if (!MARKER_RE.test(text)) {
    return text;
  }
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
  addRange,
  covers,
  literalRanges,
  rangeList,
  restoreNewlines,
};
