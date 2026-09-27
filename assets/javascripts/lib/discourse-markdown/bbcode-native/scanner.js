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

// The keys and bare flags each tag reads, by tag name (see define.js).
let tagAttributes = {};
const defaultEndRes = new Map();

export function setTagAttributes(attributes) {
  tagAttributes = attributes;
  defaultEndRes.clear();
  textCache.clear();
}

const QUOTED_VALUE_RE = /=["']/;
const BLANK_REST_RE = /[ \t]*\n/y;
const ATTR_RE = /([-\w]+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;

const TO_BRACKET_RE = /[^[\]]*/y;

// The tag's "]": the first one, unless it is inside a value quoted right after
// "=". A quote that never closes, or that a blank line or an unquoted "["
// interrupts, isn't a quoted value, and the first "]" ends the tag as before.
// A "[" before it means no tag. Scanning only to the nearest bracket keeps
// runs of unterminated openers linear.
function tagEnd(src, from) {
  TO_BRACKET_RE.lastIndex = from;
  const nearest = from + TO_BRACKET_RE.exec(src)[0].length;
  const plain = src[nearest] === "]" ? nearest : -1;
  if (!QUOTED_VALUE_RE.test(src.slice(from, nearest))) {
    return plain;
  }
  let quote = null;
  for (let index = from; index < src.length; index++) {
    const char = src[index];
    if (quote) {
      if (char === quote) {
        quote = null;
      } else if (char === "\n") {
        BLANK_REST_RE.lastIndex = index + 1;
        if (BLANK_REST_RE.test(src)) {
          break;
        }
      }
    } else if (char === "]") {
      return index;
    } else if (char === "[") {
      break;
    } else if ((char === '"' || char === "'") && src[index - 1] === "=") {
      quote = char;
    }
  }
  return plain;
}

// Bare words are a tag's attributes only when they are all its flags, as in
// [slide open]: most "[b words]" in text are not tags.
function onlyFlags(tag, text) {
  const flags = tagAttributes[tag]?.flags;
  const words = text.trim().split(/\s+/);
  return !!flags && words.every((word) => flags.includes(word.toLowerCase()));
}

function unquote(value) {
  const quote = value[0];
  return (quote === '"' || quote === "'") &&
    value.length > 1 &&
    value.endsWith(quote)
    ? value.slice(1, -1)
    : value;
}

// where the default value stops: before the first key the tag reads, outside
// a quoted value
function defaultEnd(tag, value) {
  const keys = tagAttributes[tag]?.keys;
  if (!keys?.length) {
    return value.length;
  }
  let re = defaultEndRes.get(tag);
  if (!re) {
    re = new RegExp(String.raw`\s(?:${keys.join("|")})=`, "ig");
    defaultEndRes.set(tag, re);
  }
  const quote = value[0];
  const quoteEnd =
    quote === '"' || quote === "'" ? value.indexOf(quote, 1) : -1;
  re.lastIndex = quoteEnd === -1 ? 0 : quoteEnd + 1;
  const match = re.exec(value);
  return match ? match.index : value.length;
}

// key=value pairs and bare flags such as `open`; keys are case-insensitive
function readPairs(text, attrs) {
  let attr;
  ATTR_RE.lastIndex = 0;
  while ((attr = ATTR_RE.exec(text))) {
    attrs[attr[1].toLowerCase()] = (attr[2] ?? attr[3] ?? attr[4] ?? "").trim();
  }
  for (const flag of text.replace(ATTR_RE, " ").split(/\s+/)) {
    if (/^[-\w]+$/.test(flag)) {
      attrs[flag.toLowerCase()] = flag;
    }
  }
}

// The tag runs to its "]" (see tagEnd). With no whitespace before the first
// "=", what follows is one raw value ([div=height:auto; width:100%]), up to
// the first key the tag reads ([font=Open Sans style=bold]); otherwise it is
// key=value pairs.
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

  const end = tagEnd(src, afterName);
  if (end === -1) {
    return null;
  }
  const body = src.slice(afterName, end);
  if (!body.includes("=") && !onlyFlags(tag, body)) {
    return null;
  }
  if (lengthOnly) {
    return { tag, closing: false, length: end - pos + 1 };
  }
  // the flatten pass may have swapped newlines in the attribute value
  const rest = restoreNewlines(body);
  const attrs = {};
  const defaultValue = /^\s*=/.exec(rest);
  if (defaultValue) {
    const value = rest.slice(defaultValue[0].length).trim();
    const valueEnd = defaultEnd(tag, value);
    attrs._default = unquote(value.slice(0, valueEnd).trim());
    readPairs(value.slice(valueEnd), attrs);
  } else {
    readPairs(rest, attrs);
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
// An escaped backtick can't open a code span, though one can close it:
// backslashes don't escape inside code.
const CODE_SPAN = String.raw`(?<!\x60)(?<!(?:^|[^\\])(?:\\\\)*\\)(\x60+)(?!\x60)(?:(?!\n[ \t]*\n)[\s\S])*?(?<!\x60)\1(?!\x60)`;
// Markdown passes both through whole, so no tag inside them is read. Inline,
// a comment can't cross a blank line; one starting a line is a block (see
// blockRanges).
const HTML_COMMENT = String.raw`<!--(?:(?!\n[ \t]*\n)[\s\S])*?-->`;
const AUTOLINK = String.raw`<[a-zA-Z][a-zA-Z0-9+.\-]{1,31}:[^<>\x00-\x20]*>`;

export function setLiteralTags(tags) {
  literalTags = ["code", ...tags];
  // code spans, comments, autolinks and literal tags: whichever starts first
  literalRe = new RegExp(
    `${CODE_SPAN}|${HTML_COMMENT}|${AUTOLINK}|\\[(${literalTags.join("|")})(?=[\\]=\\s])`,
    "gi"
  );
  textCache.clear();
}
setLiteralTags([]);

const isLiteralTag = (tag) => literalTags.includes(tag);

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
      tags.push({
        tag,
        closing: false,
        at: match.index,
        end: match.index + open.length,
      });
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
        at: repairAt(src, item.at, inner),
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

// A close alone on its line keeps it, since block rules such as core's [quote]
// only match it there: the inner closes go at the end of the content before it.
function repairAt(src, closeAt, inner) {
  let at = closeAt;
  while (src[at - 1] === " " || src[at - 1] === "\t") {
    at--;
  }
  if (at > 0 && src[at - 1] !== "\n") {
    return closeAt;
  }
  const floor = Math.max(...inner.map((open) => open.end));
  while (at > floor && /\s/.test(src[at - 1])) {
    at--;
  }
  return at;
}

// Edits at the same position go in the reverse of the order they were added.
// `insertedNewlines`, if given, collects where the inserts put newlines in the
// result, in order.
export function applyEdits(src, edits, insertedNewlines) {
  const parts = [];
  let pos = 0;
  let length = 0;
  for (const edit of edits.reverse().sort((a, b) => a.at - b.at)) {
    const kept = src.slice(pos, edit.at);
    length += kept.length;
    for (
      let newline = edit.insert.indexOf("\n");
      insertedNewlines && newline !== -1;
      newline = edit.insert.indexOf("\n", newline + 1)
    ) {
      insertedNewlines.push(length + newline);
    }
    length += edit.insert.length;
    parts.push(kept, edit.insert);
    pos = Math.max(pos, edit.at + edit.remove);
  }
  parts.push(src.slice(pos));
  return parts.join("");
}

const LINE_BREAK_RE = new RegExp(
  `[\n${NEWLINE_SENTINEL}${NOBR_SENTINEL}]`,
  "g"
);

// The source line each line of `text` starts on: `text` is the source with
// the newlines at `insertedNewlines` added and some newlines written as
// placeholders, which still end a source line.
export function sourceLines(text, insertedNewlines) {
  const lines = [0];
  let line = 0;
  let next = 0;
  LINE_BREAK_RE.lastIndex = 0;
  let match;
  while ((match = LINE_BREAK_RE.exec(text))) {
    if (match[0] !== "\n") {
      line++;
      continue;
    }
    if (insertedNewlines[next] === match.index) {
      next++;
    } else {
      line++;
    }
    lines.push(line);
  }
  return lines;
}

const BLOCK_LITERAL_HINT_RE = /`{3}|~{3}|<(?:pre|script|style|textarea|!--)/i;
const FENCE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const FENCE_CLOSE_RE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
// HTML blocks whose content markdown leaves alone, up to their end tag
const RAW_HTML_OPEN_RE =
  /^ {0,3}<(?:(pre|script|style|textarea)(?=[\s>]|$)|!--)/i;
const QUOTE_MARKERS_RE = /(?:[ \t]*>[ \t]?)*/y;

// the ">"s a line starts with, and the indentation after them
function lineIndent(src, lineStart) {
  QUOTE_MARKERS_RE.lastIndex = lineStart;
  const markers = QUOTE_MARKERS_RE.exec(src)[0];
  let at = lineStart + markers.length;
  while (src[at] === " " || src[at] === "\t") {
    at++;
  }
  return {
    quotes: markers.split(">").length - 1,
    indent: at - lineStart - markers.length,
    blank: src[at] === "\n" || at >= src.length,
  };
}

// Fences and raw HTML blocks, as the block stage finds them: also behind
// blockquote and list markers, where they end with their container.
function blockRanges(src) {
  const ranges = [];
  if (!BLOCK_LITERAL_HINT_RE.test(src)) {
    return ranges;
  }
  let open = null;
  let previousEnd = 0;
  for (let lineStart = 0; lineStart <= src.length; ) {
    let lineEnd = src.indexOf("\n", lineStart);
    if (lineEnd === -1) {
      lineEnd = src.length;
    }
    const head = lineHead(src, lineEnd, lineStart);
    const text = src.slice(head.end, lineEnd);
    if (open) {
      const { quotes, indent, blank } = lineIndent(src, lineStart);
      const leftContainer =
        quotes < open.quotes || (!blank && open.list && indent < open.list);
      if (leftContainer) {
        ranges.push([open.start, previousEnd]);
        open = null;
      } else if (open.closes(text)) {
        ranges.push([open.start, lineEnd]);
        open = null;
        previousEnd = lineEnd;
        lineStart = lineEnd + 1;
        continue;
      }
    }
    if (!open) {
      const fence = FENCE_OPEN_RE.exec(text);
      const html = !fence && RAW_HTML_OPEN_RE.exec(text);
      let closes = null;
      if (fence && (fence[1][0] !== "`" || !fence[2].includes("`"))) {
        const marker = fence[1];
        closes = (line) => {
          const close = FENCE_CLOSE_RE.exec(line);
          return (
            !!close &&
            close[1][0] === marker[0] &&
            close[1].length >= marker.length
          );
        };
      } else if (html) {
        const endTag = html[1] ? `</${html[1].toLowerCase()}>` : "-->";
        closes = (line) => line.toLowerCase().includes(endTag);
      }
      if (closes) {
        const { quotes } = lineIndent(src, lineStart);
        open = {
          start: lineStart,
          quotes,
          list: head.listIndent,
          closes,
        };
        // an HTML block can end on its own line
        if (html && closes(text.slice(html[0].length))) {
          ranges.push([lineStart, lineEnd]);
          open = null;
        }
      }
    }
    previousEnd = lineEnd;
    lineStart = lineEnd + 1;
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
  const fences = indexRanges(blockRanges(src));
  const found = [];
  // once a tag's close isn't found, it isn't after any later opener either
  const unclosed = new Set();
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
    const opener =
      !unclosed.has(tag) && parseLooseTag(src, at, isLiteralTag, true);
    if (!opener) {
      literalRe.lastIndex = at + 1;
      continue;
    }
    let closeRe = literalCloseRes.get(tag);
    if (!closeRe) {
      closeRe = new RegExp(`\\[/${tag}\\]`, "gi");
      literalCloseRes.set(tag, closeRe);
    }
    closeRe.lastIndex = at + opener.length;
    const close = closeRe.exec(src);
    if (close) {
      found.push([at, closeRe.lastIndex]);
      literalRe.lastIndex = closeRe.lastIndex;
    } else {
      unclosed.add(tag);
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

const CONTAINER_MARKER_RE = /[ \t]*(?:(>)[ \t]?|(?:[*+-]|\d{1,9}[.)])[ \t]+)/y;

// The blockquote and list markers the line holding `pos` starts with. `end`
// is where they stop, `pattern` strips them from a line the tag continues
// on, `insert` starts a new line inside them, and `listIndent` is how far a
// list item's own lines are indented.
export function lineHead(
  src,
  pos,
  lineStart = src.lastIndexOf("\n", pos - 1) + 1
) {
  const patterns = [];
  let insert = "";
  let end = lineStart;
  let listIndent = 0;
  let marker;
  CONTAINER_MARKER_RE.lastIndex = lineStart;
  while (
    CONTAINER_MARKER_RE.lastIndex < pos &&
    (marker = CONTAINER_MARKER_RE.exec(src))
  ) {
    end = CONTAINER_MARKER_RE.lastIndex;
    if (marker[1]) {
      // optional, as a lazy continuation line leaves it out
      patterns.push(String.raw`(?:[ \t]*>[ \t]?)?`);
      insert += marker[0];
    } else {
      patterns.push(`[ \\t]{0,${marker[0].length}}`);
      insert += " ".repeat(marker[0].length);
      listIndent += marker[0].length;
    }
  }
  return { end, pattern: patterns.join(""), insert, listIndent };
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
