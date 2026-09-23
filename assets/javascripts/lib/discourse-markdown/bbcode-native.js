// Native bbcode rules for markdown-it. Tags are found by a scanner that accepts
// the loose attribute syntax existing content uses, and each tag is rendered in
// one of these ways:
//
//  container  content is parsed as markdown blocks when the tag starts its own
//             line, and as flowing text when it starts mid-line
//  blockflow  block wrapper whose content is one flowing run of text
//  flow       inline span; content is one flowing run of text, even across
//             blank lines
//  text       content is emitted literally
//  opaque     the whole tag is rendered by BBob (data tags such as [class])
//
// Tags without a native implementation are "delegated": BBob renders only the
// wrapper HTML, and markdown-it renders the content natively.
//
// The scanner and tag tables live in ./bbcode-native/*; this file wires them
// into markdown-it's block/inline/core rulers. Self-contained on purpose:
// plugin markdown modules can't import core helpers such as parseBBCodeTag.

import {
  findClose,
  LITERAL_TAGS,
  literalRanges,
  NEWLINE_SENTINEL,
  NOBR_SENTINEL,
  parseLooseTag,
  PHANTOM,
  restoreNewlines,
} from "./bbcode-native/scanner";
import { SECTION_SPECS } from "./bbcode-native/sections";
import { CORE_SPECS } from "./bbcode-native/specs";
import {
  delegateSpec,
  flowText,
  hardenBreaks,
  OPAQUE,
  pushHtml,
  pushOpaque,
  pushText,
  renderWithBBob,
  wrapperHalves,
} from "./bbcode-native/tokens";
import { WRAPPER_SPECS } from "./bbcode-native/wrappers";

const SPECS = { ...CORE_SPECS, ...WRAPPER_SPECS, ...SECTION_SPECS };

// Tags BBob still renders. Wrapper tags: BBob produces the wrapper HTML and
// markdown-it the content. Opaque tags need BBob to see their whole content
// (CSS, scripts) or their child tags (tabs, accordion).
const DELEGATES = {};
for (const tag of [...["h", "h1", "h2", "h3", "h4", "h5", "h6", "sh"]]) {
  DELEGATES[tag] = delegateSpec("container");
}
for (const tag of ["class", "animation", "script", "fa"]) {
  DELEGATES[tag] = OPAQUE;
}

const isBreakable = (token) =>
  token.type === "paragraph_open" ||
  token.type === "fence" ||
  token.meta?.breakable ||
  (token.nesting === 1 &&
    (token.type.startsWith("bbcode_") || token.type === "html_block"));

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
function insertBreaks(tokens, Token) {
  const out = [];
  const previous = [];
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
          const count = token.map[0] - last.end + 1 - last.phantom;
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
        previous[token.level] = { end: token.map[1], phantom };
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

const specFor = (tag) => SPECS[tag] || DELEGATES[tag];
const bbobAvailable = () => !!globalThis.bbcodeParser?.RpNBBCode;
// spans that stay in one paragraph however many blank lines they contain
const alwaysFlat = (spec) => spec.kind === "flow" || spec.kind === "text";

export function setup(helper) {
  helper.registerOptions((opts, siteSettings) => {
    const configured = (siteSettings.bbcode_native_tags || "")
      .split("|")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const tags = configured.includes("*")
      ? [...Object.keys(SPECS), ...Object.keys(DELEGATES)]
      : configured.filter(specFor);
    opts.bbcodeNativeTags = tags;
    opts.features["bbcode-native"] =
      !!siteSettings.bbcode_enabled && tags.length > 0;
  });

  helper.registerPlugin((md) => {
    const enabled = new Set(md.options.discourse?.bbcodeNativeTags || []);
    const isKnown = (tag) => enabled.has(tag);
    // BBob is out of the picture: the rules below produce the whole document
    const standalone = !!md.options.discourse?.bbcodeBypass;

    // same as the BBob path: deeply indented bbcode must not become code blocks
    md.disable("code");

    if (standalone) {
      // Existing content writes every newline as a line break, and a blank line
      // as two, with no paragraphs.
      md.set({ breaks: true });
      md.renderer.rules.paragraph_close = () => "";
      md.renderer.rules.paragraph_open = () => "";
      md.renderer.rules.softbreak = (tokens, idx) =>
        tokens[idx].meta?.nobr ? "\n" : "<br>\n";
    }

    // Blank lines would end the paragraph before the inline rule can see a
    // span that is flow text, so every newline inside one is swapped for a
    // sentinel first. A container that spans lines but starts mid-line is a
    // block wherever it starts, so it is moved onto its own line instead.
    md.core.ruler.after("normalize", "bbcode-native-flatten", (state) => {
      if (!enabled.size) {
        return;
      }
      const src = state.src;
      const openRe = new RegExp(
        `\\[(${[...enabled].join("|")})(?=[\\]=\\s])`,
        "gi"
      );
      const literal = literalRanges(src, LITERAL_TAGS);
      const inRange = (ranges, pos) =>
        ranges.some(([from, to]) => pos >= from && pos < to);
      // strictly inside: the literal tag's own opener still gets flattened
      const inLiteral = (pos) =>
        literal.some(([from, to]) => pos > from && pos < to);

      // [url] is core's own inline-only tag: its content can never cross a
      // blank line, even with the plugin disabled entirely. A native
      // container nested inside one must stay flow (flattened), the same as
      // it already is inside [b]/[color]/etc, or a blank line inside it would
      // both break [url]'s own matching and put a block element inside an <a>.
      const isUrlTag = (tag) => tag === "url";
      const urlRanges = [];
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
          urlRanges.push([urlMatch.index, close.start]);
        }
      }

      const nobrRanges = [];
      if (enabled.has("nobr")) {
        const nobrRe = /\[nobr\]/gi;
        let nobr;
        while ((nobr = nobrRe.exec(src))) {
          const nobrClose = findClose(src, nobr.index + 6, "nobr", isKnown);
          if (nobrClose) {
            nobrRanges.push([nobr.index, nobrClose.start]);
          }
        }
      }

      const flattened = [];
      const edits = [];
      let out = src;
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
        const flat =
          alwaysFlat(specFor(info.tag)) || inRange(urlRanges, openAt);
        const lineStart = src.lastIndexOf("\n", openAt - 1) + 1;
        const startsLine = /^[ \t]*$/.test(src.slice(lineStart, openAt));
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
        const close = findClose(src, openAt + info.length, info.tag, isKnown);
        if (!close) {
          continue;
        }
        // the opener's own attribute value can contain blank lines too
        if (!src.slice(openAt, close.start).includes("\n")) {
          continue;
        }
        if (!flat && !startsLine && !inRange(flattened, openAt)) {
          edits.push({ at: openAt, remove: 0, insert: PHANTOM + "\n" });
          continue;
        }
        const sentinel = inRange(nobrRanges, openAt)
          ? NOBR_SENTINEL
          : NEWLINE_SENTINEL;
        out =
          out.slice(0, openAt) +
          out.slice(openAt, close.start).replaceAll("\n", sentinel) +
          out.slice(close.start);
        flattened.push([openAt, close.start]);
      }

      for (const edit of edits.reverse()) {
        out =
          out.slice(0, edit.at) +
          edit.insert +
          out.slice(edit.at + edit.remove);
      }
      state.src = out;
    });

    if (standalone) {
      md.core.ruler.after("block", "bbcode-native-breaks", (state) => {
        state.tokens = insertBreaks(state.tokens, state.Token);
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
    }

    const parseBlocks = (state, text) => {
      const tokens = [];
      state.md.block.parse(text, state.md, state.env, tokens);
      for (const token of tokens) {
        token.level += state.level;
      }
      return tokens;
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

        const text = state.getLines(startLine, endLine, state.blkIndent, false);
        const lead = text.length - text.trimStart().length;
        const info = parseLooseTag(text, lead, isKnown);
        if (!info || info.closing) {
          return false;
        }
        let spec = specFor(info.tag);
        if (
          spec.inlineOnly ||
          !["container", "blockflow", "opaque", "sections", "text"].includes(
            spec.kind
          )
        ) {
          return false;
        }
        if (spec.delegate && !bbobAvailable()) {
          return false;
        }
        const close = findClose(text, lead + info.length, info.tag, isKnown);
        if (!close) {
          return false;
        }
        if (
          spec.spansLines &&
          !text.slice(lead + info.length, close.start).includes("\n")
        ) {
          return false;
        }
        const sections =
          spec.kind === "sections"
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

        if (spec !== OPAQUE && spec.delegate) {
          info.halves = wrapperHalves(state, info);
          spec = info.halves ? spec : OPAQUE;
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
            const leading = standalone ? edge(/^\s*/) : 0;
            const trailing = standalone && body.trim() ? edge(/\s*$/) : 0;
            const breaks = (count) => {
              if (count > 0) {
                pushHtml(state, "<br>".repeat(Math.min(count, 20))).meta = {
                  br: true,
                };
              }
            };
            breaks(leading);
            const tokens = parseBlocks(state, body.trim());
            state.tokens.push(...tokens);
            breaks(trailing);
            spec.sectionClose(state, section);
          });
          spec.close(state, info);
        } else if (spec.kind === "text") {
          const content = text.slice(lead + info.length, close.start);
          const token = pushText(state, spec, restoreNewlines(content));
          token.map = map;
          token.meta = { ...token.meta, breakable: true };
        } else if (spec === OPAQUE) {
          const html = renderWithBBob(
            state,
            restoreNewlines(text.slice(lead, close.end))
          );
          const token = pushOpaque(state, html);
          if (token) {
            token.map = map;
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
          if (spec.decorate) {
            // the line breaks before this tag are counted from the marker; the
            // tokens inside it only know their own position within the tag
            const start = pushHtml(state, "");
            start.map = map;
            start.meta = { breakable: true };
          }
          const pushBreaks = (count) => {
            if (count > 0 && standalone && !spec.decorate) {
              pushHtml(state, "<br>".repeat(Math.min(count, 20))).meta = {
                br: true,
              };
            }
          };
          pushBreaks(leading);

          if (spec.kind === "container") {
            const tokens = parseBlocks(state, content.trim());
            spec.decorate?.(tokens);
            state.tokens.push(...tokens);
          } else {
            const inline = state.push("inline", "", 0);
            inline.content = flowText(content.replace(/^\n|\n$/g, "")).trim();
            inline.meta = { flow: true };
            inline.children = [];
            inline.map = map;
          }
          pushBreaks(trailing);
          spec.close(state, info);
          markTrimAfter(state, spec);
          if (spec.decorate) {
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

    md.inline.ruler.before("link", "bbcode-native-inline", (state, silent) => {
      if (state.src.charCodeAt(state.pos) !== 0x5b) {
        return false;
      }
      const info = parseLooseTag(state.src, state.pos, isKnown);
      if (!info || info.closing) {
        return false;
      }
      let spec = specFor(info.tag);
      if (spec.delegate && !bbobAvailable()) {
        return false;
      }
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
        spec.kind === "sections"
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

      if (spec.kind === "text") {
        spec.render(state, restoreNewlines(inner));
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
        if (spec !== OPAQUE && spec.delegate) {
          info.halves = wrapperHalves(state, info);
          spec = info.halves ? spec : OPAQUE;
        }

        if (spec === OPAQUE) {
          pushOpaque(
            state,
            renderWithBBob(
              state,
              restoreNewlines(state.src.slice(state.pos, close.end))
            )
          );
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
          spec.decorate?.(tokens);
          state.tokens.push(...tokens);
          spec.close(state, info);
          markTrimAfter(state, spec);
        }
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

    if (standalone) {
      // XenForo drops the line break right after some tags' close (and after
      // code blocks). Only a break that directly follows the close goes: text
      // in between keeps it.
      md.core.ruler.push("bbcode-native-trim-after", (state) => {
        const trims = (token) =>
          token?.meta?.trimAfter || token?.type === "fence";
        const dropBreak = (token) => {
          if (
            token?.type === "html_block" &&
            token.content.startsWith("<br>")
          ) {
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
    }

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

    // the styles and scripts BBob produced, emitted once for the whole post
    md.core.ruler.push("bbcode-native-templates", (state) => {
      const styles = state.env.bbcodeStyles || [];
      const scripts = state.env.bbcodeScripts || [];
      if (!styles.length && !scripts.length) {
        return;
      }
      const token = new state.Token("html_block", "", 0);
      token.block = true;
      token.content =
        globalThis.bbcodeParser.postprocess("", {
          styles,
          bbscripts: scripts,
          hoistMap: {},
        }) + "\n";
      state.tokens.unshift(token);
    });
  });

  helper.allowList([
    "details.bb-spoiler",
    "div.bb-spoiler-content",
    "div.bb-background",
    "span.bb-pindent",
    "summary",
    "div[style=*]",
    "span[style=*]",
  ]);
}
