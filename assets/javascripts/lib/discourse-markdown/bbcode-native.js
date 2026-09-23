// Native bbcode rules for markdown-it. Tags are found by a scanner that accepts
// the loose attribute syntax existing content uses, and each tag is rendered as
// its definition says (see ./bbcode-native/define.js for the format, and
// ./bbcode-native/tags.js for the tags).
//
// This file wires the definitions into markdown-it's block/inline/core rulers.
// Self-contained on purpose: plugin markdown modules can't import core helpers
// such as parseBBCodeTag.

import { bbcodePlusTemplates, PLUS_TAGS } from "./bbcode-native/plus";
import {
  covers,
  findClose,
  literalRanges,
  needsBlocks,
  NEWLINE_SENTINEL,
  NOBR_SENTINEL,
  parseLooseTag,
  PHANTOM,
  repairNesting,
  restoreNewlines,
  setLiteralTags,
} from "./bbcode-native/scanner";
import { SECTION_TAGS } from "./bbcode-native/sections";
import { TAGS } from "./bbcode-native/tags";
import {
  flowText,
  hardenBreaks,
  pushHtml,
  pushText,
} from "./bbcode-native/tokens";

const SPECS = { ...TAGS, ...SECTION_TAGS, ...PLUS_TAGS };
const tagsWhere = (test) =>
  Object.keys(SPECS).filter((tag) => test(SPECS[tag]));
// tags whose newlines are not line breaks ([nobr])
const NO_BREAK_TAGS = tagsWhere((spec) => spec.lineBreaks === false);
setLiteralTags(tagsWhere((spec) => spec.content === "literal"));

// Core's tags and section children: not rendered by these rules, but their
// closes still close the tags nested in them
const NESTING_ONLY = [
  "url",
  "quote",
  ...Object.values(SPECS).flatMap((spec) => spec.children || []),
];

// every token of a tag with `lineBreaks: false`
function markNoBreaks(tokens) {
  for (const token of tokens) {
    token.meta = { ...token.meta, nobr: true };
    token.children?.forEach((child) => {
      child.meta = { ...child.meta, nobr: true };
    });
  }
}

// Markdown blocks whose margin already stands for one blank line around them
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

// The line breaks for `newlines` newlines between two blocks. Next to a
// markdown block, its margin replaces one blank line; a break right after text
// only ends that line, so it doesn't show.
function gapBreaks(newlines, last, token) {
  if (!last.margin && !MARGIN_BLOCKS.includes(token.type)) {
    return newlines;
  }
  return newlines < 2 ? 0 : newlines - 2 + (last.text ? 1 : 0);
}

// the close a tag just pushed, for bbcode-native-trim-after
function markTrimAfter(state, spec) {
  const close = state.tokens.at(-1);
  if (spec.trimAfter && close) {
    close.meta = { ...close.meta, trimAfter: true };
  }
}

// Existing content writes every newline as a line break. Text inside a
// paragraph gets them from `breaks`; the newlines between two blocks are worked
// out from where the blocks sit in the source.
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
    if (token.meta?.br && token.meta.nobr) {
      return;
    }
    const isOpener = token.nesting === 1;
    if (token.nesting !== -1 && !token.hidden) {
      // a block of unknown span ends the gap count rather than being skipped
      if (token.map && isBreakable(token) && !token.meta?.nobr) {
        const last = previous[token.level];
        if (last) {
          const count = gapBreaks(
            token.map[0] - last.end + 1 - last.phantom,
            last,
            token
          );
          if (count > 0) {
            const br = new Token("html_block", "", 0);
            br.block = true;
            br.level = token.level;
            br.content = "<br>".repeat(Math.min(count, 20));
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

const specFor = (tag) => SPECS[tag];
// spans that stay in one paragraph however many blank lines they contain
const alwaysFlat = (spec) =>
  spec.content === "inline" || spec.content === "literal";

export function setup(helper) {
  helper.registerOptions((opts, siteSettings) => {
    opts.features["bbcode-native"] = !!siteSettings.bbcode_enabled;
  });

  helper.registerPlugin((md) => {
    const isKnown = (tag) => Object.hasOwn(SPECS, tag);
    // our tags, plus core's and the section children they commonly nest in
    const isNestable = (tag) => isKnown(tag) || NESTING_ONLY.includes(tag);

    // deeply indented bbcode must not become code blocks
    md.disable("code");

    // Existing content writes every newline as a line break, and a blank line
    // as two, with no paragraphs.
    md.set({ breaks: true });
    md.renderer.rules.paragraph_close = () => "";
    md.renderer.rules.paragraph_open = () => "";
    md.renderer.rules.softbreak = (tokens, idx) =>
      tokens[idx].meta?.nobr ? "\n" : "<br>\n";
    md.renderer.rules.bbcode_plain_text = (tokens, idx) =>
      md.utils.escapeHtml(tokens[idx].content);

    // Blank lines would end the paragraph before the inline rule can see a
    // span that is flow text, so every newline inside one is swapped for a
    // sentinel first. A container that spans lines but starts mid-line is a
    // block wherever it starts, so it is moved onto its own line instead.
    md.core.ruler.after("normalize", "bbcode-native-flatten", (state) => {
      state.src = repairNesting(state.src, isNestable);
      const src = state.src;
      const openRe = new RegExp(
        `\\[(${Object.keys(SPECS).join("|")})(?=[\\]=\\s])`,
        "gi"
      );
      const literal = literalRanges(src);
      // ranges added in order of where they start, looked up with covers()
      const rangeList = () => Object.assign([], { furthest: [] });
      const addRange = (ranges, range) => {
        ranges.push(range);
        ranges.furthest.push(Math.max(ranges.furthest.at(-1) ?? -1, range[1]));
      };
      // strictly inside: the literal tag's own opener still gets flattened
      const inLiteral = (pos) => covers(literal, pos, true);

      // [url] is core's own inline-only tag: its content can never cross a
      // blank line, even with the plugin disabled entirely. A native
      // container nested inside one must stay flow (flattened), the same as
      // it already is inside [b]/[color]/etc, or a blank line inside it would
      // both break [url]'s own matching and put a block element inside an <a>.
      const isUrlTag = (tag) => tag === "url";
      const urlRanges = rangeList();
      const urlRe = /\[url(?=[\]=\s])/gi;
      let urlMatch;
      while ((urlMatch = urlRe.exec(src))) {
        if (inLiteral(urlMatch.index)) {
          continue;
        }
        const info = parseLooseTag(src, urlMatch.index, isUrlTag);
        if (!info || info.closing) {
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
      if (NO_BREAK_TAGS.length) {
        const nobrRe = new RegExp(
          `\\[(${NO_BREAK_TAGS.join("|")})(?=[\\]=\\s])`,
          "gi"
        );
        let nobr;
        while ((nobr = nobrRe.exec(src))) {
          const info = parseLooseTag(src, nobr.index, isKnown);
          const nobrClose =
            info && findClose(src, nobr.index + info.length, info.tag, isKnown);
          if (nobrClose) {
            addRange(nobrRanges, [nobr.index, nobrClose.start]);
          }
        }
      }

      const flattened = rangeList();
      const edits = [];
      let match;
      while ((match = openRe.exec(src))) {
        const openAt = match.index;
        if (inLiteral(openAt)) {
          continue;
        }
        const info = parseLooseTag(src, openAt, isKnown);
        if (!info || info.closing) {
          continue;
        }
        const spec = specFor(info.tag);
        const lineStart = src.lastIndexOf("\n", openAt - 1) + 1;
        const startsLine = /^[ \t]*$/.test(src.slice(lineStart, openAt));
        const alwaysFlow = alwaysFlat(spec) || covers(urlRanges, openAt);
        // a line-start block container needs no close here: the block rule
        // finds it
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
                src.slice(openAt + info.length, close.start),
                startsLine,
                state,
                blockStarts()
              )
            ));
        if (startsLine && !flat) {
          // markdown-it never lets a line indented 4+ spaces interrupt a
          // paragraph, and indentation carries no meaning here
          if (openAt > lineStart) {
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
        // the opener's own attribute value can contain blank lines too
        if (!src.slice(openAt, close.start).includes("\n")) {
          continue;
        }
        if (!flat && !startsLine && !covers(flattened, openAt)) {
          edits.push({ at: openAt, remove: 0, insert: PHANTOM + "\n" });
          continue;
        }
        const sentinel = covers(nobrRanges, openAt)
          ? NOBR_SENTINEL
          : NEWLINE_SENTINEL;
        addRange(flattened, [openAt, close.start, sentinel]);
      }

      // Core renders a [code] spanning lines as a code block only when its
      // tags sit on lines of their own; XenForo always does, so they are given
      // their own lines. Mid-line, the one added before it isn't the author's.
      const codeRe = /\[code(?=[\]=\s])[^\]]*\]/gi;
      const lowerSrc = src.toLowerCase();
      while ((match = codeRe.exec(src))) {
        const openAt = match.index;
        const openEnd = codeRe.lastIndex;
        const closeAt = lowerSrc.indexOf("[/code]", openEnd);
        if (
          inLiteral(openAt) ||
          covers(flattened, openAt) ||
          closeAt === -1 ||
          !src.slice(openEnd, closeAt).includes("\n")
        ) {
          continue;
        }
        const closeEnd = closeAt + "[/code]".length;
        const lineStart = src.lastIndexOf("\n", openAt - 1) + 1;
        const closeLineStart = src.lastIndexOf("\n", closeAt - 1) + 1;
        if (src.slice(lineStart, openAt).trim()) {
          edits.push({ at: openAt, remove: 0, insert: PHANTOM + "\n" });
        }
        if (!/^[ \t]*(\n|$)/.test(src.slice(openEnd))) {
          edits.push({ at: openEnd, remove: 0, insert: "\n" });
        }
        if (src.slice(closeLineStart, closeAt).trim()) {
          edits.push({ at: closeAt, remove: 0, insert: "\n" });
        }
        if (!/^[ \t]*(\n|$)/.test(src.slice(closeEnd))) {
          edits.push({ at: closeEnd, remove: 0, insert: "\n" });
        }
        codeRe.lastIndex = closeEnd;
      }

      // Built in one pass each, as posts can be long. Where flattened spans
      // overlap, the one opened first picks the sentinel; edits at the same
      // position go in the reverse of the order they were added.
      const flatParts = [];
      let done = 0;
      for (const [from, to, sentinel] of flattened) {
        if (to > done) {
          const start = Math.max(from, done);
          flatParts.push(
            src.slice(done, start),
            src.slice(start, to).replaceAll("\n", sentinel)
          );
          done = to;
        }
      }
      flatParts.push(src.slice(done));
      const out = flatParts.join("");

      const edited = [];
      let pos = 0;
      for (const edit of edits.reverse().sort((a, b) => a.at - b.at)) {
        edited.push(out.slice(pos, edit.at), edit.insert);
        pos = Math.max(pos, edit.at + edit.remove);
      }
      edited.push(out.slice(pos));
      state.src = edited.join("");
    });

    md.core.ruler.after("block", "bbcode-native-breaks", (state) => {
      state.tokens = insertBreaks(
        state.tokens,
        state.Token,
        state.src.split("\n")
      );
    });

    // Core's own block bbcode ([quote], [code], ...) doesn't record which
    // lines it covers, which the line breaks around it are counted from.
    const coreRule = md.block.ruler.__rules__.find(
      (rule) => rule.name === "bbcode"
    );
    if (coreRule) {
      const apply = coreRule.fn;
      md.block.ruler.at(
        "bbcode",
        (state, startLine, endLine, silent) => {
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
              markTrimAfter(state, { trimAfter: true });
            }
          }
          return true;
        },
        { alt: coreRule.alt }
      );
    }

    const parseBlocks = (state, text) => {
      const tokens = [];
      state.md.block.parse(text, state.md, state.env, tokens);
      for (const token of tokens) {
        token.level += state.level;
      }
      return tokens;
    };

    // one line of content: read as text, like a paragraph, but never as
    // markdown blocks
    const lineTokens = (state, text) => {
      const inline = new state.Token("inline", "", 0);
      inline.content = text.trim();
      inline.children = [];
      inline.level = state.level;
      inline.block = true;
      return [inline];
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
        // no indentation limit: indented code blocks are disabled for bbcode
        const first = state.bMarks[startLine] + state.tShift[startLine];
        if (state.src.charCodeAt(first) !== 0x5b) {
          return false;
        }

        // This runs for every line starting with "[", including each time
        // markdown-it checks whether a paragraph ends there, so the tag is
        // matched in the source first and only the lines up to its close are
        // copied out.
        const opener = parseLooseTag(state.src, first, isKnown);
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
        const lines = sourceClose
          ? lineAfter(state, startLine, endLine, sourceClose.end)
          : endLine;

        let text = state.getLines(startLine, lines, state.blkIndent, false);
        const lead = text.length - text.trimStart().length;
        const info = parseLooseTag(text, lead, isKnown);
        if (!info || info.closing) {
          return false;
        }
        const offset = state.bMarks[startLine];
        // the lines as they are in the source: nothing stripped from them
        const unchanged =
          sourceClose && text.length === state.eMarks[lines - 1] - offset;
        let close = unchanged
          ? { start: sourceClose.start - offset, end: sourceClose.end - offset }
          : findClose(text, lead + info.length, info.tag, isKnown);
        // container markers (a blockquote's ">") are only in the source
        if (!close && lines < endLine) {
          text = state.getLines(startLine, endLine, state.blkIndent, false);
          close = findClose(text, lead + info.length, info.tag, isKnown);
        }
        if (!close) {
          return false;
        }
        if (
          spec.content === "auto" &&
          !needsBlocks(
            text.slice(lead + info.length, close.start),
            true,
            state,
            blockStarts()
          )
        ) {
          return false;
        }
        const sections =
          spec.content === "sections"
            ? spec.sections(
                text.slice(lead + info.length, close.start),
                isKnown
              )
            : null;
        if (sections && !sections.length) {
          return false;
        }
        if (silent) {
          return true;
        }

        const closeLine =
          startLine + text.slice(0, close.start).split("\n").length - 1;
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
            const body = section.body;
            const edge = (pattern) =>
              (body.match(pattern)?.[0].match(/\n/g) || []).length;
            const leading = edge(/^\s*/);
            const trailing = body.trim() ? edge(/\s*$/) : 0;
            const breaks = (count) => {
              if (count > 0) {
                pushHtml(state, "<br>".repeat(Math.min(count, 20))).meta = {
                  br: true,
                };
              }
            };
            breaks(leading);
            state.tokens.push(
              ...(body.includes("\n")
                ? parseBlocks(state, body.trim())
                : lineTokens(state, body))
            );
            breaks(trailing);
            spec.sectionClose(state, section);
          });
          spec.close(state, info);
        } else if (spec.content === "literal") {
          const content = text.slice(lead + info.length, close.start);
          const token = pushText(state, spec, restoreNewlines(content), info);
          if (token.children.length) {
            token.map = map;
            token.meta = { ...token.meta, breakable: true };
          } else {
            // data tags ([class], [script], ...) render nothing here
            state.tokens.pop();
          }
        } else {
          const content = text.slice(lead + info.length, close.start);
          const newlines = (edge) => (edge.match(/\n/g) || []).length;
          const leading = spec.trimInside
            ? 0
            : newlines(content.match(/^\s*/)[0]);
          const trailing =
            content.trim() && !spec.trimInside
              ? newlines(content.match(/\s*$/)[0])
              : 0;
          const open = spec.open(state, info);
          if (open) {
            open.map = map;
          }
          const noBreaks = spec.lineBreaks === false;
          if (noBreaks) {
            // the line breaks before this tag are counted from the marker; the
            // tokens inside it only know their own position within the tag
            const start = pushHtml(state, "");
            start.map = map;
            start.meta = { breakable: true };
          }
          const pushBreaks = (count) => {
            if (count > 0 && !noBreaks) {
              pushHtml(state, "<br>".repeat(Math.min(count, 20))).meta = {
                br: true,
              };
            }
          };
          pushBreaks(leading);

          if (spec.content === "text") {
            const inline = state.push("inline", "", 0);
            inline.content = flowText(content.replace(/^\n|\n$/g, "")).trim();
            inline.meta = { flow: true };
            inline.children = [];
            inline.map = map;
          } else {
            // content on the same line as both tags is never markdown blocks:
            // [div]+[/div] is a "+", not a list
            const tokens = content.includes("\n")
              ? parseBlocks(state, content.trim())
              : lineTokens(state, content);
            if (noBreaks) {
              markNoBreaks(tokens);
            }
            state.tokens.push(...tokens);
          }
          pushBreaks(trailing);
          spec.close(state, info);
          markTrimAfter(state, spec);
          if (noBreaks) {
            // and the next block's count starts from where it ends
            const marker = pushHtml(state, "");
            marker.map = map;
            marker.meta = { breakable: true };
          }
        }

        if (rest.trim()) {
          // the tail sits on the close's own line
          const tail = parseBlocks(state, rest);
          tail.forEach((token) => {
            token.map &&= [closeLine, closeLine + 1];
          });
          state.tokens.push(...tail);
        }

        state.line = closeLine + 1;
        return true;
      },
      { alt: ["paragraph", "reference", "blockquote", "list"] }
    );

    // What starts a block inside a paragraph: markdown-it's rules and other
    // plugins'. A nested bbcode tag isn't one; it flows with the text.
    const nativeBlock = md.block.ruler.__rules__.find(
      (rule) => rule.name === "bbcode-native-block"
    ).fn;
    const blockStarts = () =>
      md.block.ruler
        .getRules("paragraph")
        .filter((rule) => rule !== nativeBlock);

    md.inline.ruler.before("link", "bbcode-native-inline", (state, silent) => {
      if (state.src.charCodeAt(state.pos) !== 0x5b) {
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
      const sections =
        spec.content === "sections"
          ? spec.sections(
              state.src.slice(state.pos + info.length, close.start),
              isKnown
            )
          : null;
      if (sections && !sections.length) {
        return false;
      }
      if (silent) {
        state.pos = close.end;
        return true;
      }

      // tokens pushed without state.push would otherwise land before the text
      // that precedes the tag
      state.pushPending();
      const inner = state.src.slice(state.pos + info.length, close.start);

      if (spec.content === "literal") {
        spec.render(state, restoreNewlines(inner), info);
      } else if (sections) {
        spec.open(state, info);
        sections.forEach((section, index) => {
          spec.sectionOpen(state, section, index, info);
          const tokens = [];
          state.md.inline.parse(
            flowText(section.body),
            state.md,
            state.env,
            tokens
          );
          hardenBreaks(tokens);
          for (const token of tokens) {
            token.level += state.level;
          }
          state.tokens.push(...tokens);
          spec.sectionClose(state, section);
        });
        spec.close(state, info);
      } else {
        spec.open(state, info);
        const tokens = [];
        const text = flowText(inner);
        state.md.inline.parse(
          spec.trimInside ? text.trim() : text,
          state.md,
          state.env,
          tokens
        );
        hardenBreaks(tokens);
        for (const token of tokens) {
          token.level += state.level;
        }
        if (spec.lineBreaks === false) {
          markNoBreaks(tokens);
        }
        state.tokens.push(...tokens);
        spec.close(state, info);
        markTrimAfter(state, spec);
      }

      state.pos = close.end;
      return true;
    });

    // inline tokens are parsed after the block rules ran, so what they need to
    // know about their surroundings is passed along in `meta`
    md.core.ruler.push("bbcode-native-inline-meta", (state) => {
      for (const token of state.tokens) {
        if (token.type !== "inline" || !token.children) {
          continue;
        }
        if (token.meta?.nobr) {
          token.children.forEach((child) => {
            child.meta = { ...child.meta, nobr: true };
          });
        }
        if (token.meta?.flow) {
          hardenBreaks(token.children);
        }
      }
    });

    // XenForo drops the line break right after some tags' close (and after
    // code blocks). Only a break that directly follows the close goes: text
    // in between keeps it.
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

    // the post's [class]/[animation] CSS and [script]s, emitted once
    md.core.ruler.push("bbcode-native-templates", (state) => {
      const templates = bbcodePlusTemplates(state.env);
      if (!templates) {
        return;
      }
      const token = new state.Token("html_block", "", 0);
      token.block = true;
      token.content = templates + "\n";
      state.tokens.unshift(token);
    });
  });

  helper.allowList([
    "details.bb-spoiler",
    "div.bb-spoiler-content",
    "div.bb-background",
    "span.bb-pindent",
    // inline styling tags around markdown blocks
    "div.bbcode-b",
    "div.bbcode-i",
    "div.bbcode-u",
    "div.bbcode-s",
    "div.bb-pindent",
    "div.bb-highlight",
    "summary",
    "div[style=*]",
    "span[style=*]",
  ]);
}
