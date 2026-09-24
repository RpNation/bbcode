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

// An odd number of backslashes before it makes a character literal, as in
// markdown, so `\[b]` is text. Only openers: markdown-it's escapes keep the
// inline rule from seeing them, while closes are found only here, and XenForo
// posts write `\[/div]` for a backslash before a close.
export function isEscaped(src, pos) {
  let count = 0;
  while (src.charCodeAt(pos - count - 1) === 0x5c) {
    count++;
  }
  return count % 2 === 1;
}

// with fenced code, never read as bbcode
let literalTags;
let literalRe;
// Results per source text: several rules scan the same text in one cook, and
// markdown-it checks the same lines many times. Emptied per cook.
const textCache = new Map();
const TEXT_CACHE_SIZE = 20;
const closeRes = new Map();
const literalCloseRes = new Map();
const CODE_SPAN = String.raw`(?<!\x60)(\x60+)(?!\x60)(?:(?!\n[ \t]*\n)[\s\S])*?(?<!\x60)\1(?!\x60)`;

export function setLiteralTags(tags) {
  literalTags = ["code", ...tags];
  // code spans and literal tags: whichever starts first wins
  literalRe = new RegExp(
    `${CODE_SPAN}|\\[(${literalTags.join("|")})(?=[\\]=\\s])[^\\]]*\\]`,
    "gi"
  );
  textCache.clear();
}
setLiteralTags([]);

export function resetTextCache() {
  textCache.clear();
}

// The matching close, counting nested tags of the same name; null when never
// closed, which leaves the tag as text.
export function findClose(src, from, tag, isKnown, limit = src.length) {
  // only isKnown(tag) affects the result
  const known = isKnown(tag);
  const pairs = memoFor(src, `pairs:${tag}:${known}`, () =>
    tagPairs(src, tag, known)
  );
  const { starts, ends, nextLower } = pairs;
  // the first opener or close at or after `from`
  let low = 0;
  let high = starts.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (starts[mid] < from) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  const after = nextLower[low];
  if (after === -1) {
    return null;
  }
  const close = { start: starts[after - 1], end: ends[after - 1] };
  return close.start < limit ? close : null;
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

// Every opener and close of `tag` in one pass, so that each findClose is a
// lookup: a search from event i closes at the first later point where more
// closes than openers have been seen, i.e. the next lower running balance.
function tagPairs(src, tag, known) {
  const literal = literalTags.includes(tag);
  // a "[nobr]" shown inside [plain] isn't a real one
  const skip = literal ? [] : literalRanges(src);
  const isOpener = () => true;
  let re = closeRes.get(tag);
  if (!re) {
    re = new RegExp(`\\[(/?)${tag}(?![a-z0-9])`, "gi");
    closeRes.set(tag, re);
  }
  re.lastIndex = 0;
  const starts = [];
  const ends = [];
  // balances[i]: openers minus closes before event i
  const balances = [0];
  let match;
  while ((match = re.exec(src))) {
    const at = match.index;
    if (covers(skip, at)) {
      continue;
    }
    let end;
    if (match[1]) {
      if (src[at + match[0].length] !== "]") {
        continue;
      }
      end = at + match[0].length + 1;
    } else {
      // inside literal content a backslash is just text
      const escaped = !literal && isEscaped(src, at);
      const open = known && !escaped && parseLooseTag(src, at, isOpener, true);
      if (!open) {
        continue;
      }
      end = at + open.length;
      re.lastIndex = end;
    }
    starts.push(at);
    ends.push(end);
    balances.push(balances.at(-1) + (match[1] ? -1 : 1));
  }

  // nextLower[i]: the first j > i with a lower balance, or -1
  const nextLower = new Array(balances.length).fill(-1);
  const waiting = [];
  balances.forEach((balance, index) => {
    while (waiting.length && balances[waiting.at(-1)] > balance) {
      nextLower[waiting.pop()] = index;
    }
    waiting.push(index);
  });
  return { starts, ends, nextLower };
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
    const open =
      !isEscaped(src, match.index) &&
      parseLooseTag(src, match.index, isKnown, true);
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

// Fences first, as block-level markdown. Then code spans and literal tags left
// to right, as the inline parser meets them: "`[plain]`" is code, and
// "[plain]`[/plain]" is plain text.
function findLiteralRanges(src) {
  const fences = indexRanges(fenceRanges(src));
  const found = [];
  literalRe.lastIndex = 0;
  let match;
  while ((match = literalRe.exec(src))) {
    const at = match.index;
    const fenceEnd = coverEnd(fences, at);
    if (fenceEnd !== -1) {
      literalRe.lastIndex = fenceEnd;
      continue;
    }
    if (!match[2]) {
      found.push([at, literalRe.lastIndex]);
      continue;
    }
    if (isEscaped(src, at)) {
      literalRe.lastIndex = at + 1;
      continue;
    }
    const tag = match[2].toLowerCase();
    let closeRe = literalCloseRes.get(tag);
    if (!closeRe) {
      closeRe = new RegExp(`\\[/${tag}\\]`, "gi");
      literalCloseRes.set(tag, closeRe);
    }
    closeRe.lastIndex = literalRe.lastIndex;
    const close = closeRe.exec(src);
    if (close) {
      found.push([at, closeRe.lastIndex]);
      literalRe.lastIndex = closeRe.lastIndex;
    }
  }
  return indexRanges([...fences, ...found]);
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
  return coverEnd(ranges, pos, strictly) !== -1;
}

// where the ranges covering `pos` end, or -1
function coverEnd(ranges, pos, strictly = false) {
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
  return last !== -1 && ranges.furthest[last] > pos
    ? ranges.furthest[last]
    : -1;
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
  coverEnd,
  covers,
  literalRanges,
  rangeList,
  restoreNewlines,
};
