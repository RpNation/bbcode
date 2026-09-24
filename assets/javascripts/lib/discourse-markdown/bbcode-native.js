// bbcode as markdown-it rules; the tag definitions are in ./bbcode-native/.
// Plugin markdown modules can't import core helpers such as parseBBCodeTag.

import { bbcodePlusTemplates, PLUS_TAGS } from "./bbcode-native/plus";
import {
  addRange,
  applyEdits,
  covers,
  findClose,
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
} from "./bbcode-native/scanner";
import { SECTION_TAGS } from "./bbcode-native/sections";
import { TAGS } from "./bbcode-native/tags";
import {
  brs,
  edgeNewlines,
  flowText,
  hardenBreaks,
  parseInline,
  pushBreaks,
  pushHtml,
  pushText,
} from "./bbcode-native/tokens";

const SPECS = { ...TAGS, ...SECTION_TAGS, ...PLUS_TAGS };
const tagsWhere = (test) =>
  Object.keys(SPECS).filter((tag) => test(SPECS[tag]));
const openerRe = (tags) =>
  new RegExp(`\\[(${tags.join("|")})(?=[\\]=\\s])`, "gi");
const OPEN_RE = openerRe(Object.keys(SPECS));
const NO_BREAK_TAGS = tagsWhere((spec) => spec.lineBreaks === false);
const NO_BREAK_RE = NO_BREAK_TAGS.length ? openerRe(NO_BREAK_TAGS) : null;
setLiteralTags(tagsWhere((spec) => spec.content === "literal"));

// not rendered here, but their closes still close the tags nested inside
const NESTING_ONLY = [
  "url",
  "quote",
  ...Object.values(SPECS).flatMap((spec) => spec.children || []),
];

function markNoBreaks(tokens) {
  for (const token of tokens) {
    token.meta = { ...token.meta, nobr: true };
    token.children?.forEach((child) => {
      child.meta = { ...child.meta, nobr: true };
    });
  }
}

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
            br.content = brs(count);
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
// never split by blank lines
const alwaysFlat = (spec) =>
  spec.content === "inline" || spec.content === "literal";

export function setup(helper) {
  helper.registerOptions((opts, siteSettings) => {
    opts.features["bbcode-native"] = !!siteSettings.bbcode_enabled;
  });

  helper.registerPlugin((md) => {
    const isKnown = (tag) => Object.hasOwn(SPECS, tag);
    const isNestable = (tag) => isKnown(tag) || NESTING_ONLY.includes(tag);

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
      state.src = repairNesting(state.src, isNestable);
      const src = state.src;
      const literal = literalRanges(src);
      // strictly inside: the literal tag's own opener still gets flattened
      const inLiteral = (pos) => covers(literal, pos, true);

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
      let match;
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
        let lineStart = openAt;
        while (src[lineStart - 1] === " " || src[lineStart - 1] === "\t") {
          lineStart--;
        }
        const startsLine = lineStart === 0 || src[lineStart - 1] === "\n";
        // inside a flattened span, only how far the tag reaches matters
        if (!startsLine && covers(flattened, openAt)) {
          const close = findClose(src, openAt + info.length, info.tag, isKnown);
          if (close && src.slice(openAt, close.start).includes("\n")) {
            addRange(flattened, [
              openAt,
              close.start,
              covers(nobrRanges, openAt) ? NOBR_SENTINEL : NEWLINE_SENTINEL,
            ]);
          }
          continue;
        }
        const alwaysFlow = alwaysFlat(spec) || covers(urlRanges, openAt);
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
                src.slice(openAt + info.length, close.start),
                startsLine,
                state,
                blockStarts()
              )
            ));
        if (startsLine && !flat) {
          // a line indented 4+ spaces can't interrupt a paragraph
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
        // counts newlines in the opener's attribute value too
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

      // Core renders a multi-line [code] as a block only when its tags are on
      // their own lines; XenForo always does.
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

      // where flattened spans overlap, the first one opened picks the sentinel
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
      state.src = applyEdits(flatParts.join(""), edits);
    });

    md.core.ruler.after("block", "bbcode-native-breaks", (state) => {
      state.tokens = insertBreaks(
        state.tokens,
        state.Token,
        state.src.split("\n")
      );
    });

    // core's block bbcode sets no token.map, which the line-break count needs
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
              markTrimAfter(state);
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

    // content on the same line as both tags is never markdown blocks:
    // [div]+[/div] is a "+", not a list
    const contentTokens = (state, text) => {
      if (text.includes("\n")) {
        return parseBlocks(state, text.trim());
      }
      const inline = new state.Token("inline", "", 0);
      inline.content = text.trim();
      inline.children = [];
      inline.level = state.level;
      inline.block = true;
      return [inline];
    };

    // the line breaks around a [nobr] block are counted from these
    const pushMarker = (state, map) => {
      const marker = pushHtml(state, "");
      marker.map = map;
      marker.meta = { breakable: true };
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
        if (state.src.charCodeAt(first) !== 0x5b) {
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
        let lines = sourceClose
          ? lineAfter(state, startLine, endLine, sourceClose.end)
          : endLine;

        let text = state.getLines(startLine, lines, state.blkIndent, false);
        const lead = text.length - text.trimStart().length;
        const info = parseLooseTag(text, lead, isKnown);
        if (!info || info.closing) {
          return false;
        }
        const offset = state.bMarks[startLine];
        // nothing stripped, such as a blockquote's ">", so positions carry over
        const unchanged =
          sourceClose && text.length === state.eMarks[lines - 1] - offset;
        let close = unchanged
          ? { start: sourceClose.start - offset, end: sourceClose.end - offset }
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
            state.tokens.push(...contentTokens(state, section.body));
            pushBreaks(state, trailing);
            spec.sectionClose(state);
          });
          spec.close(state, info);
        } else if (spec.content === "literal") {
          const token = pushText(state, spec, restoreNewlines(content), info);
          if (token.children.length) {
            token.map = map;
            token.meta = { ...token.meta, breakable: true };
          } else {
            // data tags ([class], [script], ...) render nothing here
            state.tokens.pop();
          }
        } else {
          const noBreaks = spec.lineBreaks === false;
          const [leading, trailing] =
            spec.trimInside || noBreaks ? [0, 0] : edgeNewlines(content);
          const open = spec.open(state, info);
          if (open) {
            open.map = map;
          }
          if (noBreaks) {
            pushMarker(state, map);
          }
          pushBreaks(state, leading);

          if (spec.content === "text") {
            const inline = state.push("inline", "", 0);
            inline.content = flowText(content.replace(/^\n|\n$/g, "")).trim();
            inline.meta = { flow: true };
            inline.children = [];
            inline.map = map;
          } else {
            const tokens = contentTokens(state, content);
            if (noBreaks) {
              markNoBreaks(tokens);
            }
            state.tokens.push(...tokens);
          }
          pushBreaks(state, trailing);
          spec.close(state, info);
          if (spec.trimAfter) {
            markTrimAfter(state);
          }
          if (noBreaks) {
            pushMarker(state, map);
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

    // rules that can end a paragraph, minus ours: a nested bbcode tag flows
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
          const tokens = parseInline(state, flowText(section.body));
          hardenBreaks(tokens);
          state.tokens.push(...tokens);
          spec.sectionClose(state);
        });
        spec.close(state, info);
      } else {
        spec.open(state, info);
        const text = flowText(inner);
        const tokens = parseInline(state, spec.trimInside ? text.trim() : text);
        hardenBreaks(tokens);
        if (spec.lineBreaks === false) {
          markNoBreaks(tokens);
        }
        state.tokens.push(...tokens);
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
          token.children.forEach((child) => {
            child.meta = { ...child.meta, nobr: true };
          });
        }
        if (token.meta?.flow) {
          hardenBreaks(token.children);
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

    // [class]/[animation] CSS and [script]s, once per post
    md.core.ruler.push("bbcode-native-templates", (state) => {
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
