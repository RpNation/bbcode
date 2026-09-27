// bbcode as markdown-it rules; the tag definitions are in ./bbcode-native/.
// Plugin markdown modules can't import core helpers such as parseBBCodeTag.

import { bbcodePlusTemplates, PLUS_TAGS } from "./bbcode-native/plus";
import {
  addRange,
  applyEdits,
  covers,
  findClose,
  isEscaped,
  lineHead,
  literalRanges,
  memoFor,
  needsBlocks,
  NEWLINE_SENTINEL,
  NOBR_SENTINEL,
  parseLooseTag,
  PHANTOM,
  rangeList,
  repairNesting,
  resetTextCache,
  restoreNewlines,
  setLiteralTags,
  setTagAttributes,
  sourceLines,
} from "./bbcode-native/scanner";
import { SECTION_TAGS } from "./bbcode-native/sections";
import { TAGS } from "./bbcode-native/tags";
import {
  brs,
  depthOf,
  edgeNewlines,
  flowText,
  MAX_DEPTH,
  parseAt,
  parseInline,
  pushBreaks,
  pushHtml,
  pushText,
  pushTokens,
  setDepth,
  tooDeep,
} from "./bbcode-native/tokens";

const SPECS = { ...TAGS, ...SECTION_TAGS, ...PLUS_TAGS };
const FORGED_PLUS_RE = /\bdata-bbcode-plus\b/gi;
const MARKER_RE = new RegExp(`[${NEWLINE_SENTINEL}${NOBR_SENTINEL}${PHANTOM}]`);
const LINE_PLACEHOLDER_RE = new RegExp(
  `[${NEWLINE_SENTINEL}${NOBR_SENTINEL}]`,
  "g"
);
const PLACEHOLDER_RE = new RegExp(
  `[${NEWLINE_SENTINEL}${NOBR_SENTINEL}${PHANTOM}]`,
  "g"
);
const tagsWhere = (test) =>
  Object.keys(SPECS).filter((tag) => test(SPECS[tag]));
const openerRe = (tags) =>
  new RegExp(`\\[(${tags.join("|")})(?=[\\]=\\s])`, "gi");
const OPEN_RE = openerRe(Object.keys(SPECS));
const NO_BREAK_TAGS = tagsWhere((spec) => spec.lineBreaks === false);
const NO_BREAK_RE = NO_BREAK_TAGS.length ? openerRe(NO_BREAK_TAGS) : null;
setLiteralTags(tagsWhere((spec) => spec.content === "literal"));
setTagAttributes(
  Object.assign(
    {},
    ...Object.entries(SPECS).map(([tag, spec]) => ({
      ...(spec.attributes && { [tag]: spec.attributes }),
      ...spec.childAttributes,
    }))
  )
);

// not rendered here, but their closes still close the tags nested inside
const NESTING_ONLY = [
  "url",
  "quote",
  ...Object.values(SPECS).flatMap((spec) => spec.children || []),
];

// Inside [nobr] a newline stays a newline, for the browser to show as a space.
function markNoBreak(token) {
  token.meta = { ...token.meta, nobr: true };
}

function markNoBreaks(tokens) {
  for (const token of tokens) {
    markNoBreak(token);
    token.children?.forEach(markNoBreak);
  }
}

const rawNewlines = (count) => "\n".repeat(count);

// their margin stands for one blank line
const MARGIN_BLOCKS = [
  "heading_open",
  "bullet_list_open",
  "ordered_list_open",
  "table_open",
  "blockquote_open",
  "hr",
];

const isBreakable = (token) =>
  token.type === "paragraph_open" ||
  token.type === "fence" ||
  MARGIN_BLOCKS.includes(token.type) ||
  token.meta?.breakable ||
  (token.nesting === 1 &&
    (token.type.startsWith("bbcode_") || token.type === "html_block"));

// Next to a markdown block its margin replaces one blank line, and a break
// right after text only ends that line.
function gapBreaks(newlines, last, token) {
  if (!last.margin && !MARGIN_BLOCKS.includes(token.type)) {
    return newlines;
  }
  return newlines < 2 ? 0 : newlines - 2 + (last.text ? 1 : 0);
}

// read by bbcode-native-trim-after
function markTrimAfter(state) {
  const close = state.tokens.at(-1);
  if (close) {
    close.meta = { ...close.meta, trimAfter: true };
  }
}

// Every newline is a line break: `breaks` covers those inside a paragraph, and
// the ones between blocks are counted from the blocks' source lines.
function insertBreaks(tokens, Token, lines) {
  const out = [];
  const previous = [];
  // a list's span includes the blank lines after it; they are the gap
  const lastLine = ([start, end]) => {
    while (end > start + 1 && !lines[end - 1]?.trim()) {
      end--;
    }
    return end;
  };
  tokens.forEach((token, index) => {
    const isOpener = token.nesting === 1;
    if (token.nesting !== -1 && !token.hidden) {
      // a block of unknown span ends the gap count rather than being skipped
      if (token.map && isBreakable(token)) {
        const nobr = !!token.meta?.nobr;
        const last = previous[token.level];
        // [nobr] has no element, so its content shares a level with the
        // blocks around it, but its lines are counted from its own start
        if (last && last.nobr === nobr) {
          const gap = token.map[0] - last.end + 1 - last.phantom;
          const count = nobr ? gap : gapBreaks(gap, last, token);
          if (count > 0) {
            const br = new Token("html_block", "", 0);
            br.block = true;
            br.level = token.level;
            br.content = nobr ? rawNewlines(count) : brs(count);
            out.push(br);
          }
        }
        let phantom = 0;
        const inline = tokens[index + 1];
        if (
          token.type === "paragraph_open" &&
          inline?.type === "inline" &&
          inline.content.endsWith(PHANTOM)
        ) {
          inline.content = inline.content.slice(0, -1).trimEnd();
          phantom = 1;
        }
        previous[token.level] = {
          end: MARGIN_BLOCKS.includes(token.type)
            ? lastLine(token.map)
            : token.map[1],
          phantom,
          margin: MARGIN_BLOCKS.includes(token.type),
          text: token.type === "paragraph_open",
          nobr,
        };
      } else {
        previous[token.level] = null;
      }
    }
    if (isOpener) {
      previous[token.level + 1] = null;
    }
    out.push(token);
  });
  return out;
}

// the text as the block stage reads it: `pattern`, from lineHead, taken off
// each line after the first
function withoutMarkers(text, pattern) {
  return pattern ? text.replace(new RegExp(`\n${pattern}`, "g"), "\n") : text;
}

const specFor = (tag) => SPECS[tag];

// the newlines in `text` before `end`
function countNewlines(text, end) {
  let count = 0;
  for (
    let at = text.indexOf("\n");
    at !== -1 && at < end;
    at = text.indexOf("\n", at + 1)
  ) {
    count++;
  }
  return count;
}
// never split by blank lines
const alwaysFlat = (spec) =>
  spec.content === "inline" || spec.content === "literal";

export function setup(helper) {
  helper.registerOptions((opts, siteSettings) => {
    opts.features["bbcode-native"] = !!siteSettings.bbcode_enabled;
  });

  helper.registerPlugin((md) => {
    const isKnown = (tag) => Object.hasOwn(SPECS, tag);
    // Block tags other rules register, such as [details], are looked up per
    // cook: those rules may be added after this one.
    // Core's bbcode rules search the rest of the text for the close of each
    // opener of another rule's tag, which is quadratic when many never close.
    // The searches are greedy, so an opener after its tag's last close can't
    // close: the rule is returned so its search can be skipped, with the
    // result it would reach. The text is left as it is.
    const TAG_NAME_RE = /[a-z][\w-]*/iy;
    const neverClosed = (src, pos, ruler) => {
      TAG_NAME_RE.lastIndex = pos + 1;
      const name = TAG_NAME_RE.exec(src)?.[0].toLowerCase();
      const rule = name && !isKnown(name) && ruler?.getRuleForTag(name)?.rule;
      if (!rule) {
        return null;
      }
      const lower = memoFor(src, "lower", () => src.toLowerCase());
      const lastClose = memoFor(src, `lastClose:${name}`, () =>
        lower.lastIndexOf(`[/${name}]`)
      );
      return lastClose < pos ? rule : null;
    };

    const isNestable = (tag) =>
      isKnown(tag) ||
      NESTING_ONLY.includes(tag) ||
      !!md.block.bbcode?.ruler.getRuleForTag(tag);

    // deeply indented bbcode must not become code blocks
    md.disable("code");

    // as XenForo renders posts: every newline a line break, no paragraphs
    md.set({ breaks: true });
    md.renderer.rules.paragraph_close = () => "";
    md.renderer.rules.paragraph_open = () => "";
    md.renderer.rules.softbreak = (tokens, idx) =>
      tokens[idx].meta?.nobr ? "\n" : "<br>\n";
    md.renderer.rules.bbcode_plain_text = (tokens, idx) =>
      md.utils.escapeHtml(tokens[idx].content);

    // Newlines inside flow spans become sentinels, so a blank line can't end
    // the paragraph before the inline rule sees the span. A multi-line block
    // tag starting mid-line is moved onto its own line instead.
    md.core.ruler.after("normalize", "bbcode-native-flatten", (state) => {
      resetTextCache();
      // restored once parsing is done, for rules that match it to the post
      state.env.bbcodeSource = state.src;
      // The placeholders below would read them as newlines; core drops them.
      state.src = repairNesting(
        state.src.replace(PLACEHOLDER_RE, ""),
        isNestable
      );
      const src = state.src;
      const literal = literalRanges(src);
      // strictly inside: the literal tag's own opener still gets flattened.
      // A backslash-escaped tag is text too.
      const inLiteral = (pos) =>
        covers(literal, pos, true) || isEscaped(src, pos);

      // Core's [url] can't cross a blank line, and a block can't go in an
      // <a>, so tags inside one always flow.
      const isUrlTag = (tag) => tag === "url";
      const urlRanges = rangeList();
      const urlRe = /\[url(?=[\]=\s])/gi;
      let urlMatch;
      while ((urlMatch = urlRe.exec(src))) {
        if (inLiteral(urlMatch.index)) {
          continue;
        }
        const info = parseLooseTag(src, urlMatch.index, isUrlTag, true);
        if (!info) {
          continue;
        }
        const close = findClose(
          src,
          urlMatch.index + info.length,
          "url",
          isUrlTag
        );
        if (close) {
          addRange(urlRanges, [urlMatch.index, close.start]);
        }
      }

      const nobrRanges = rangeList();
      if (NO_BREAK_RE) {
        NO_BREAK_RE.lastIndex = 0;
        let nobr;
        while ((nobr = NO_BREAK_RE.exec(src))) {
          if (inLiteral(nobr.index)) {
            continue;
          }
          const info = parseLooseTag(src, nobr.index, isKnown, true);
          const nobrClose =
            info && findClose(src, nobr.index + info.length, info.tag, isKnown);
          if (nobrClose) {
            addRange(nobrRanges, [nobr.index, nobrClose.start]);
          }
        }
      }

      const flattened = rangeList();
      const edits = [];
      const lowerSrc = src.toLowerCase();
      let match;
      // Openers come in order, so each line start is found from the last one:
      // searching back from every tag is quadratic on a long line.
      let knownLineStart = 0;
      let seen = 0;
      const lineStartOf = (pos) => {
        const newline = src.slice(seen, pos).lastIndexOf("\n");
        if (newline !== -1) {
          knownLineStart = seen + newline + 1;
        }
        seen = pos;
        return knownLineStart;
      };
      OPEN_RE.lastIndex = 0;
      while ((match = OPEN_RE.exec(src))) {
        const openAt = match.index;
        if (inLiteral(openAt)) {
          continue;
        }
        const info = parseLooseTag(src, openAt, isKnown, true);
        if (!info) {
          continue;
        }
        const spec = specFor(info.tag);
        // in a blockquote or list item, the line starts after their markers
        const lineBegin = lineStartOf(openAt);
        const head = lineHead(src, openAt, lineBegin);
        const inContainer = head.end > lineBegin;
        let lineStart = openAt;
        while (
          lineStart > head.end &&
          (src[lineStart - 1] === " " || src[lineStart - 1] === "\t")
        ) {
          lineStart--;
        }
        const startsLine = lineStart === head.end;
        const spansLines = (close) => {
          const newline = src.indexOf("\n", openAt);
          return newline !== -1 && newline < close.start;
        };
        const covered = covers(flattened, openAt);
        // nothing to do: its newlines are already sentinels, and there's no
        // indentation to strip
        if (covered && (openAt === lineStart || (startsLine && inContainer))) {
          continue;
        }
        // inside a flattened span, only how far the tag reaches matters
        if (!startsLine && covered) {
          const close = findClose(src, openAt + info.length, info.tag, isKnown);
          if (close && spansLines(close)) {
            addRange(flattened, [
              openAt,
              close.start,
              covers(nobrRanges, openAt) ? NOBR_SENTINEL : NEWLINE_SENTINEL,
              head.pattern,
            ]);
          }
          continue;
        }
        // Moving a bare tag onto its own line would show: the spaces around
        // it would be lost.
        const alwaysFlow =
          alwaysFlat(spec) ||
          covers(urlRanges, openAt) ||
          (spec.bare && !startsLine);
        // the block rule matches a line-start block tag itself
        const close =
          !startsLine || alwaysFlow || spec.content === "auto"
            ? findClose(src, openAt + info.length, info.tag, isKnown)
            : null;
        const flat =
          alwaysFlow ||
          (spec.content === "auto" &&
            !(
              close &&
              needsBlocks(
                withoutMarkers(
                  src.slice(openAt + info.length, close.start),
                  head.pattern
                ),
                startsLine,
                state,
                blockStarts()
              )
            ));
        if (startsLine && !flat) {
          // A line indented 4+ spaces can't interrupt a paragraph. In a
          // container the markers set the indentation, so it stays.
          if (openAt > lineStart && !inContainer) {
            edits.push({
              at: lineStart,
              remove: openAt - lineStart,
              insert: "",
            });
          }
          continue;
        }
        if (!close) {
          continue;
        }
        // counts newlines in the opener's attribute value too
        if (!spansLines(close)) {
          continue;
        }
        if (!flat && !startsLine && !covered) {
          edits.push({
            at: openAt,
            remove: 0,
            insert: PHANTOM + "\n" + head.insert,
          });
          continue;
        }
        const sentinel = covers(nobrRanges, openAt)
          ? NOBR_SENTINEL
          : NEWLINE_SENTINEL;
        addRange(flattened, [openAt, close.start, sentinel, head.pattern]);
      }

      // Core renders a multi-line [code] as a block only when its tags are on
      // their own lines; XenForo always does.
      const codeRe = /\[code(?=[\]=\s])/gi;
      const isCode = (tag) => tag === "code";
      // Openers come in order, so the next close and newline are found from
      // the last ones: searching from every opener is quadratic.
      let closeAt = -2;
      let newlineAt = -2;
      while ((match = codeRe.exec(src))) {
        const openAt = match.index;
        const opener = parseLooseTag(src, openAt, isCode, true);
        if (!opener) {
          continue;
        }
        const openEnd = openAt + opener.length;
        if (closeAt < openEnd) {
          closeAt = lowerSrc.indexOf("[/code]", openEnd);
        }
        if (closeAt === -1) {
          break;
        }
        if (newlineAt !== -1 && newlineAt < openEnd) {
          newlineAt = src.indexOf("\n", openEnd);
        }
        if (
          inLiteral(openAt) ||
          covers(flattened, openAt) ||
          newlineAt === -1 ||
          newlineAt > closeAt
        ) {
          continue;
        }
        const closeEnd = closeAt + "[/code]".length;
        const head = lineHead(src, openAt);
        const newLine = "\n" + head.insert;
        if (src.slice(head.end, openAt).trim()) {
          edits.push({ at: openAt, remove: 0, insert: PHANTOM + newLine });
        }
        if (!/^[ \t]*(\n|$)/.test(src.slice(openEnd))) {
          edits.push({ at: openEnd, remove: 0, insert: newLine });
        }
        if (src.slice(lineHead(src, closeAt).end, closeAt).trim()) {
          edits.push({ at: closeAt, remove: 0, insert: newLine });
        }
        if (!/^[ \t]*(\n|$)/.test(src.slice(closeEnd))) {
          edits.push({ at: closeEnd, remove: 0, insert: newLine });
        }
        codeRe.lastIndex = closeEnd;
      }

      // Where flattened spans overlap, the first one opened picks the sentinel.
      // A container's markers on the lines joined are taken out, as the block
      // stage would have: the sentinels keep positions, so the edits do it.
      const flatParts = [];
      let done = 0;
      for (const [from, to, sentinel, markers] of flattened) {
        if (to > done) {
          const start = Math.max(from, done);
          flatParts.push(
            src.slice(done, start),
            src.slice(start, to).replaceAll("\n", sentinel)
          );
          if (markers) {
            const markerRe = new RegExp(markers, "y");
            for (
              let nl = src.indexOf("\n", start);
              nl !== -1 && nl < to;
              nl = src.indexOf("\n", nl + 1)
            ) {
              markerRe.lastIndex = nl + 1;
              const length = markerRe.exec(src)?.[0].length ?? 0;
              const remove = Math.min(length, to - nl - 1);
              if (remove > 0) {
                edits.push({ at: nl + 1, remove, insert: "" });
              }
            }
          }
          done = to;
        }
      }
      flatParts.push(src.slice(done));
      const insertedNewlines = [];
      state.src = applyEdits(flatParts.join(""), edits, insertedNewlines);
      state.env.bbcodeLines =
        state.src === state.env.bbcodeSource
          ? null
          : sourceLines(state.src, insertedNewlines);
    });

    md.core.ruler.after("block", "bbcode-native-breaks", (state) => {
      state.tokens = insertBreaks(
        state.tokens,
        state.Token,
        state.src.split("\n")
      );
    });

    // each inline token at the depth it sat at, which content other rules
    // parse from inside it also sees
    const coreInline = md.core.ruler.__rules__.find(
      (rule) => rule.name === "inline"
    ).fn;
    md.core.ruler.at("inline", (state) => {
      for (const token of state.tokens) {
        if (token.type === "inline") {
          state.env.bbcodeDepth = token.meta?.bbcodeDepth ?? 0;
          coreInline({ ...state, tokens: [token] });
        }
      }
      state.env.bbcodeDepth = 0;
    });

    // Rules after parsing, such as checklists, match line maps and paragraph
    // text to the post as written: the pre-pass's lines and placeholders are
    // mapped back. Paragraph text keeps its length, as offsets into it are
    // kept.
    md.core.ruler.after("inline", "bbcode-native-source-lines", (state) => {
      const lines = state.env.bbcodeLines;
      if (lines) {
        const sourceLine = (line) =>
          line < lines.length
            ? lines[line]
            : lines.at(-1) + line - lines.length + 1;
        for (const token of state.tokens) {
          if (token.map) {
            token.map = [sourceLine(token.map[0]), sourceLine(token.map[1])];
          }
          if (token.type === "inline" && MARKER_RE.test(token.content)) {
            token.content = token.content
              .replaceAll(PHANTOM + "\n", PHANTOM + PHANTOM)
              .replace(LINE_PLACEHOLDER_RE, "\n");
          }
        }
      }
      if (state.env.bbcodeSource !== undefined) {
        state.src = state.env.bbcodeSource;
      }
    });

    const coreInlineRule = md.inline.ruler.__rules__.find(
      (rule) => rule.name === "bbcode-inline"
    );
    if (coreInlineRule) {
      const apply = coreInlineRule.fn;
      md.inline.ruler.at("bbcode-inline", (state, silent) => {
        const rule =
          state.src.charCodeAt(state.pos) === 0x5b &&
          neverClosed(state.src, state.pos, md.inline.bbcode?.ruler);
        if (!rule) {
          return apply(state, silent);
        }
        // a replaced tag isn't matched without its close
        if (rule.replace) {
          return false;
        }
        // a wrapping tag becomes text, and its delimiter can't pair
        const delimiters = state.delimiters.length;
        const matched = apply(state, silent);
        state.delimiters.length = delimiters;
        return matched;
      });
    }

    // Core oneboxes a link alone on its line only in a top-level paragraph.
    // In this plugin's block tags, such as [center], it counts as top level:
    // while core's rule runs, such a paragraph reads as one. A tag written on
    // one line holds no paragraph, so its link stays inline, and quotes,
    // lists and other containers keep core's rule.
    const coreOnebox = md.core.ruler.__rules__.find(
      (rule) => rule.name === "onebox"
    );
    if (coreOnebox) {
      const apply = coreOnebox.fn;
      const isBlockTag = (token) => /^bbcode_.+_open$/.test(token.type);
      md.core.ruler.at("onebox", (state, silent) => {
        const lowered = [];
        const open = [];
        for (const token of state.tokens) {
          if (token.nesting === -1) {
            open.pop();
            continue;
          }
          if (
            token.type === "paragraph_open" &&
            open.length &&
            open.every(isBlockTag)
          ) {
            lowered.push([token, token.level]);
            token.level = 0;
          }
          if (token.nesting === 1) {
            open.push(token);
          }
        }
        apply(state, silent);
        for (const [token, level] of lowered) {
          token.level = level;
        }
      });
    }

    // core's block bbcode sets no token.map, which the line-break count needs
    const coreRule = md.block.ruler.__rules__.find(
      (rule) => rule.name === "bbcode"
    );
    if (coreRule) {
      const apply = coreRule.fn;
      md.block.ruler.at(
        "bbcode",
        (state, startLine, endLine, silent) => {
          // Checking whether a line ends a paragraph doesn't search; only
          // matching does.
          const start = state.bMarks[startLine] + state.tShift[startLine];
          if (
            !silent &&
            state.src.charCodeAt(start) === 0x5b &&
            neverClosed(state.src, start, md.block.bbcode?.ruler)
          ) {
            return false;
          }
          const from = state.tokens.length;
          if (!apply(state, startLine, endLine, silent)) {
            return false;
          }
          const first = state.tokens[from];
          if (!silent && first && !first.map) {
            first.map = [startLine, state.line];
            first.meta = { ...first.meta, breakable: true };
            const opener = state.src.slice(
              state.bMarks[startLine] + state.tShift[startLine]
            );
            if (/^\[quote(?=[\]=\s])/i.test(opener)) {
              markTrimAfter(state);
            }
          }
          return true;
        },
        { alt: coreRule.alt }
      );
    }

    // `line`: where `text` starts, so its tokens' line maps count from there
    const parseBlocks = (state, text, depth, line = 0) => {
      const tokens = parseAt(state, depth, (list) =>
        state.md.block.parse(text, state.md, state.env, list)
      );
      for (const token of tokens) {
        // parsed at this depth later; nested blocks have set their own
        if (token.type === "inline") {
          setDepth(token, depth);
        }
        if (line && token.map) {
          token.map = [token.map[0] + line, token.map[1] + line];
        }
      }
      return tokens;
    };

    const inlineToken = (state, text, depth) => {
      const inline = new state.Token("inline", "", 0);
      inline.content = text;
      inline.children = [];
      setDepth(inline, depth);
      return inline;
    };

    // content on the same line as both tags is never markdown blocks:
    // [div]+[/div] is a "+", not a list
    const contentTokens = (state, text, line) => {
      const start =
        line + countNewlines(text, text.length - text.trimStart().length);
      if (text.includes("\n")) {
        return parseBlocks(state, text.trim(), depthOf(state) + 1, start);
      }
      const inline = inlineToken(state, text.trim(), depthOf(state) + 1);
      inline.level = state.level;
      inline.block = true;
      inline.map = [start, start + 1];
      return [inline];
    };

    // what parseBlocks makes of a line without blocks
    const paragraph = (state, text) => {
      const tokens = [
        new state.Token("paragraph_open", "p", 1),
        inlineToken(state, text.trim(), depthOf(state)),
        new state.Token("paragraph_close", "p", -1),
      ];
      tokens.forEach((token, index) => {
        token.map = index < 2 ? [0, 1] : null;
        token.level = state.level + (index === 1 ? 1 : 0);
        token.block = true;
      });
      return tokens;
    };

    // the line breaks around a [nobr] block are counted from these
    const pushMarker = (state, map) => {
      const marker = pushHtml(state, "");
      marker.map = map;
      marker.meta = { breakable: true };
    };

    // where each line starts in `text`
    const lineStarts = (text) => {
      const starts = [0];
      for (
        let at = text.indexOf("\n");
        at !== -1;
        at = text.indexOf("\n", at + 1)
      ) {
        starts.push(at + 1);
      }
      return starts;
    };

    // The line of the opener's close in the quote's text with its ">"s taken
    // out, or null. Every line of a quote is read with the same markers taken
    // out, so the text is built once per quote and each close is a lookup.
    const strippedCloseLine = (state, startLine, endLine, opener) => {
      const key = `quote:${endLine}:${state.bMarks[endLine - 1]}:${state.blkIndent}`;
      let quote = memoFor(state.src, key, () => ({ from: startLine }));
      if (startLine < quote.from) {
        quote = { from: startLine };
      }
      quote.text ??= state.getLines(
        quote.from,
        endLine,
        state.blkIndent,
        false
      );
      quote.starts ??= lineStarts(quote.text);
      const index = startLine - quote.from;
      const lineStart = quote.starts[index];
      const line = quote.text.slice(
        lineStart,
        quote.starts[index + 1] ?? quote.text.length
      );
      const from = lineStart + line.length - line.trimStart().length;
      const close = findClose(
        quote.text,
        from + opener.length,
        opener.tag,
        isKnown
      );
      if (!close) {
        return null;
      }
      let low = index;
      let high = quote.starts.length - 1;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (quote.starts[mid] <= close.start) {
          low = mid;
        } else {
          high = mid - 1;
        }
      }
      return quote.from + low;
    };

    // the first line after the one `pos` is on
    const lineAfter = (state, startLine, endLine, pos) => {
      let low = startLine + 1;
      let high = endLine;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (state.bMarks[mid] < pos) {
          low = mid + 1;
        } else {
          high = mid;
        }
      }
      return low;
    };

    md.block.ruler.after(
      "fence",
      "bbcode-native-block",
      (state, startLine, endLine, silent) => {
        // any indentation: code blocks are disabled
        const first = state.bMarks[startLine] + state.tShift[startLine];
        if (state.src.charCodeAt(first) !== 0x5b || tooDeep(state)) {
          return false;
        }

        // Runs for every "[" line, each paragraph-end check included, so the
        // tag is matched in the source and only its own lines are copied.
        const opener = parseLooseTag(state.src, first, isKnown, true);
        if (!opener || opener.closing) {
          return false;
        }
        const spec = specFor(opener.tag);
        if (spec.inlineOnly || spec.content === "inline") {
          return false;
        }
        const sourceClose = findClose(
          state.src,
          first + opener.length,
          opener.tag,
          isKnown,
          state.eMarks[endLine - 1]
        );
        // Taking out a blockquote's ">"s can make a blank line that ends a
        // code span, which then no longer hides a close: only then is the
        // stripped text searched.
        const lineStart = state.bMarks[startLine];
        const inQuote =
          lineStart > 0 && state.src.charCodeAt(lineStart - 1) !== 0x0a;
        let lines;
        if (sourceClose) {
          lines = lineAfter(state, startLine, endLine, sourceClose.end);
        } else {
          const lastClose = memoFor(state.src, `lastClose:${opener.tag}`, () =>
            memoFor(state.src, "lower", () =>
              state.src.toLowerCase()
            ).lastIndexOf(`[/${opener.tag}]`)
          );
          const closeLine =
            inQuote &&
            lastClose > first &&
            strippedCloseLine(state, startLine, endLine, opener);
          if (!closeLine) {
            return false;
          }
          lines = closeLine + 1;
        }

        let text = state.getLines(startLine, lines, state.blkIndent, false);
        const lead = text.length - text.trimStart().length;
        const info = parseLooseTag(text, lead, isKnown);
        if (!info || info.closing) {
          return false;
        }
        const offset = state.bMarks[startLine];
        // nothing stripped, such as a blockquote's ">", so positions carry over
        const unchanged = text.length === state.eMarks[lines - 1] - offset;
        let close =
          unchanged && sourceClose
            ? {
                start: sourceClose.start - offset,
                end: sourceClose.end - offset,
              }
            : findClose(text, lead + info.length, info.tag, isKnown);
        if (!close && lines < endLine) {
          lines = endLine;
          text = state.getLines(startLine, lines, state.blkIndent, false);
          close = findClose(text, lead + info.length, info.tag, isKnown);
        }
        if (!close) {
          return false;
        }
        const content = text.slice(lead + info.length, close.start);
        const contentLine = startLine + countNewlines(text, lead + info.length);
        // markdown-it asks about the same line more than once
        if (
          spec.content === "auto" &&
          !memoFor(
            state.src,
            `blocks:${startLine}:${lines}:${state.blkIndent}`,
            () => needsBlocks(content, true, state, blockStarts())
          )
        ) {
          return false;
        }
        const sections =
          spec.content === "sections" ? spec.sections(content, isKnown) : null;
        if (sections && !sections.length) {
          return false;
        }
        if (silent) {
          return true;
        }

        let closeLine = startLine;
        for (
          let nl = text.indexOf("\n");
          nl !== -1 && nl < close.start;
          nl = text.indexOf("\n", nl + 1)
        ) {
          closeLine++;
        }
        const map = [startLine, closeLine + 1];
        const lineEnd = text.indexOf("\n", close.end);
        const rest = text.slice(
          close.end,
          lineEnd === -1 ? text.length : lineEnd
        );

        if (sections) {
          const open = spec.open(state, info);
          open.map = map;
          sections.forEach((section, index) => {
            spec.sectionOpen(state, section, index, info);
            const [leading, trailing] = edgeNewlines(section.body);
            pushBreaks(state, leading);
            pushTokens(
              state,
              contentTokens(
                state,
                section.body,
                contentLine + countNewlines(content, section.start)
              )
            );
            pushBreaks(state, trailing);
            spec.sectionClose(state);
          });
          spec.close(state, info);
        } else if (spec.content === "literal") {
          const token = pushText(state, spec, restoreNewlines(content), info);
          if (token.children.length) {
            token.map = map;
            token.meta = { ...token.meta, breakable: true };
            // It renders inline, but the tail is parsed as a new block, which
            // trims the space between them.
            const space = /^[ \t]*/.exec(rest)[0];
            if (space && rest.trim()) {
              const spaceToken = new state.Token("text", "", 0);
              spaceToken.content = space;
              token.children.push(spaceToken);
            }
          } else {
            // data tags ([class], [script], ...) render nothing here
            state.tokens.pop();
          }
        } else {
          const noBreaks = spec.lineBreaks === false;
          const [leading, trailing] = spec.trimInside
            ? [0, 0]
            : edgeNewlines(content);
          const open = spec.open(state, info);
          if (open) {
            open.map = map;
          }
          if (noBreaks) {
            pushMarker(state, map);
            state.env.bbcodeNoBreaks = (state.env.bbcodeNoBreaks || 0) + 1;
          }
          pushBreaks(state, leading);

          if (spec.content === "text") {
            const inline = state.push("inline", "", 0);
            inline.content = flowText(content.replace(/^\n|\n$/g, "")).trim();
            inline.children = [];
            setDepth(inline, depthOf(state) + 1);
            const line =
              contentLine +
              countNewlines(
                content,
                content.length - content.trimStart().length
              );
            inline.map = [line, line + 1];
          } else {
            const tokens = contentTokens(state, content, contentLine);
            if (noBreaks) {
              markNoBreaks(tokens);
            }
            pushTokens(state, tokens);
          }
          pushBreaks(state, trailing);
          if (noBreaks) {
            state.env.bbcodeNoBreaks--;
          }
          spec.close(state, info);
          if (spec.trimAfter) {
            markTrimAfter(state);
          }
          if (noBreaks) {
            pushMarker(state, map);
          }
        }

        if (rest.trim()) {
          // The tail sits on the close's own line. Each is parsed inside the
          // one before, so a long run of them is left to the inline rule.
          state.env.bbcodeTails = (state.env.bbcodeTails || 0) + 1;
          const tail =
            state.env.bbcodeTails > MAX_DEPTH
              ? paragraph(state, rest)
              : parseBlocks(state, rest, depthOf(state));
          state.env.bbcodeTails--;
          tail.forEach((token) => {
            token.map &&= [closeLine, closeLine + 1];
          });
          pushTokens(state, tail);
        }

        state.line = closeLine + 1;
        return true;
      },
      { alt: ["paragraph", "reference", "blockquote", "list"] }
    );

    // rules that can end a paragraph, minus ours: a nested bbcode tag flows
    const nativeBlock = md.block.ruler.__rules__.find(
      (rule) => rule.name === "bbcode-native-block"
    ).fn;
    const blockStarts = () =>
      md.block.ruler
        .getRules("paragraph")
        .filter((rule) => rule !== nativeBlock);

    md.inline.ruler.before("link", "bbcode-native-inline", (state, silent) => {
      if (state.src.charCodeAt(state.pos) !== 0x5b || tooDeep(state)) {
        return false;
      }
      const info = parseLooseTag(state.src, state.pos, isKnown);
      if (!info || info.closing) {
        return false;
      }
      const spec = specFor(info.tag);
      const close = findClose(
        state.src,
        state.pos + info.length,
        info.tag,
        isKnown,
        state.posMax
      );
      if (!close || close.end > state.posMax) {
        return false;
      }
      const inner = state.src.slice(state.pos + info.length, close.start);
      const sections =
        spec.content === "sections" ? spec.sections(inner, isKnown) : null;
      if (sections && !sections.length) {
        return false;
      }
      if (silent) {
        state.pos = close.end;
        return true;
      }

      // or the text before the tag lands after tokens pushed without state.push
      state.pushPending();

      if (spec.content === "literal") {
        spec.render(state, restoreNewlines(inner), info);
      } else if (sections) {
        spec.open(state, info);
        sections.forEach((section, index) => {
          spec.sectionOpen(state, section, index, info);
          pushTokens(state, parseInline(state, flowText(section.body)));
          spec.sectionClose(state);
        });
        spec.close(state, info);
      } else {
        spec.open(state, info);
        const text = flowText(inner);
        const tokens = parseInline(state, spec.trimInside ? text.trim() : text);
        if (spec.lineBreaks === false) {
          markNoBreaks(tokens);
        }
        pushTokens(state, tokens);
        spec.close(state, info);
        if (spec.trimAfter) {
          markTrimAfter(state);
        }
      }

      state.pos = close.end;
      return true;
    });

    // inline content is parsed after the block rules, so context comes via meta
    md.core.ruler.push("bbcode-native-inline-meta", (state) => {
      for (const token of state.tokens) {
        if (token.type !== "inline" || !token.children) {
          continue;
        }
        if (token.meta?.nobr) {
          token.children.forEach(markNoBreak);
        }
      }
    });

    // XenForo drops the line break directly after some tags and code blocks
    md.core.ruler.push("bbcode-native-trim-after", (state) => {
      const trims = (token) =>
        token?.meta?.trimAfter || token?.type === "fence";
      const dropBreak = (token) => {
        if (token?.type === "html_block" && token.content.startsWith("<br>")) {
          token.content = token.content.slice(4);
        }
      };
      state.tokens.forEach((token, index) => {
        if (trims(token)) {
          dropBreak(state.tokens[index + 1]);
        }
        if (token.type !== "inline" || !token.children) {
          return;
        }
        token.children = token.children.filter(
          (child, i, children) =>
            !(
              ["softbreak", "hardbreak"].includes(child.type) &&
              trims(children[i - 1])
            )
        );
        // a paragraph that ends with the close: the break after the paragraph
        if (
          trims(token.children.at(-1)) &&
          state.tokens[index + 1]?.type === "paragraph_close"
        ) {
          dropBreak(state.tokens[index + 2]);
        }
      });
    });

    // a sentinel that no rule consumed must not leak out
    md.core.ruler.push("bbcode-native-cleanup", (state) => {
      const restore = (token) => {
        if (token.content) {
          token.content = restoreNewlines(token.content);
        }
        token.children?.forEach(restore);
      };
      state.tokens.forEach(restore);
    });

    // [class]/[animation] CSS and [script]s, once per post. The client runs every
    // data-bbcode-plus template, so one written as raw HTML must not keep the marker.
    md.core.ruler.push("bbcode-native-templates", (state) => {
      const disarm = (token) => {
        if (token.type === "html_block" || token.type === "html_inline") {
          token.content = token.content.replace(
            FORGED_PLUS_RE,
            "data-raw-bbcode-plus"
          );
        }
        token.children?.forEach(disarm);
      };
      // the marker only ever comes from the source, so most posts skip the walk
      if (/data-bbcode-plus/i.test(state.src)) {
        state.tokens.forEach(disarm);
      }

      const templates = bbcodePlusTemplates(state);
      if (!templates) {
        return;
      }
      const token = new state.Token("html_block", "", 0);
      token.block = true;
      token.content = templates + "\n";
      state.tokens.unshift(token);
    });
  });

  // inline styling tags holding markdown blocks; the rest is in bbcode-plugin.js
  helper.allowList([
    "div.bbcode-b",
    "div.bbcode-i",
    "div.bbcode-u",
    "div.bbcode-s",
    "div.bb-pindent",
    "div.bb-highlight",
  ]);
}
