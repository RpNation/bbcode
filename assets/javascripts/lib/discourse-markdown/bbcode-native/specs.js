// Tags with a hand-written native implementation (no BBob involvement at all).

import { parseLooseTag } from "./scanner";
import { flowSpan, guidFor } from "./tokens";
import { fontElement } from "./wrappers";

// Nothing inside may close the comment early: "-->" and "--!>" both need ">".
const escapeComment = (text) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

// Google fonts named by [font] tags inside a comment
function commentFonts(content) {
  const urls = new Set();
  const isFont = (tag) => tag === "font";
  const re = /\[font(?=[\]=\s])/gi;
  let match;
  while ((match = re.exec(content))) {
    const info = parseLooseTag(content, match.index, isFont);
    const url = info && fontElement(info.attrs).open[0]?.attrs["data-font"];
    if (url) {
      urls.add(url);
    }
  }
  return urls;
}

// Tags with a native implementation
const CORE_SPECS = {
  div: {
    kind: "container",
    open(state, info) {
      const attrs = info.attrs;
      const style = attrs.style || attrs._default;
      const token = state.push("bbcode_div_open", "div", 1);
      if (attrs.class?.trim()) {
        const suffix = guidFor(state);
        token.attrSet(
          "class",
          attrs.class
            .trim()
            .split(/\s+/)
            .map((c) => `${c}__${suffix}`)
            .join(" ")
        );
      }
      if (style) {
        token.attrSet("style", style);
      }
      return token;
    },
    close(state) {
      state.push("bbcode_div_close", "div", -1);
    },
  },

  spoiler: {
    kind: "container",
    // no line breaks just inside the tags, as with [quote], and
    // the one right after the close is dropped, as XenForo does
    trimInside: true,
    trimAfter: true,
    open(state, info) {
      const details = state.push("bbcode_spoiler_open", "details", 1);
      details.attrSet("class", "bb-spoiler");
      state.push("bbcode_summary_open", "summary", 1);
      const text = state.push("text", "", 0);
      text.content =
        "Spoiler" + (info.attrs._default ? `: ${info.attrs._default}` : "");
      state.push("bbcode_summary_close", "summary", -1);
      const content = state.push("bbcode_spoiler_content_open", "div", 1);
      content.attrSet("class", "bb-spoiler-content");
      return details;
    },
    close(state) {
      state.push("bbcode_spoiler_content_close", "div", -1);
      state.push("bbcode_spoiler_close", "details", -1);
    },
  },

  // block-level wrapper whose content is flattened into one inline run
  bg: {
    kind: "blockflow",
    open(state, info) {
      const token = state.push("bbcode_bg_open", "div", 1);
      token.attrSet("class", "bb-background");
      token.attrSet("style", `background-color: ${info.attrs._default};`);
      return token;
    },
    close(state) {
      state.push("bbcode_bg_close", "div", -1);
    },
  },

  // [br][/br] pairs are how existing content writes a line break
  br: {
    kind: "flow",
    open(state) {
      state.push("hardbreak", "br", 0);
    },
    close() {},
  },

  // suppresses the line breaks added for newlines and blank lines
  nobr: {
    kind: "container",
    open() {},
    close() {},
    decorate(tokens) {
      for (const token of tokens) {
        token.meta = { ...token.meta, nobr: true };
        token.children?.forEach((child) => {
          child.meta = { ...child.meta, nobr: true };
        });
      }
    },
  },

  // literal content
  plain: {
    kind: "text",
    render(state, content) {
      content.split("\n").forEach((line, index) => {
        if (index) {
          state.push("hardbreak", "br", 0);
        }
        state.push("text", "", 0).content = line;
      });
    },
  },
  // An HTML comment, as XenForo renders it: never shown and not in the DOM.
  // Authors also use [font] inside a comment just to load a font, so each
  // Google font named inside still gets an empty element the client's font
  // loader picks up.
  comment: {
    kind: "text",
    // stays in its paragraph, like the inline tags it used to be grouped with
    inlineOnly: true,
    render(state, content) {
      for (const url of commentFonts(content)) {
        state
          .push("bbcode_font_loader_open", "span", 1)
          .attrSet("data-font", url);
        state.push("bbcode_font_loader_close", "span", -1);
      }
      state.push("html_raw", "", 0).content =
        `<!--${escapeComment(content)}-->`;
    },
  },
  icode: {
    kind: "text",
    render(state, content) {
      // without the newlines the tags sit on, as core does for [code]
      state.push("code_inline", "code", 0).content = content.replace(
        /^\n|\n$/g,
        ""
      );
    },
  },

  b: flowSpan("b", "bbcode-b"),
  i: flowSpan("i", "bbcode-i"),
  u: flowSpan("u", "bbcode-u"),
  s: flowSpan("s", "bbcode-s"),
  pindent: flowSpan("pindent", "bb-pindent"),
  highlight: flowSpan("highlight", "bb-highlight"),
  sub: {
    kind: "flow",
    open: (state) => state.push("bbcode_sub_open", "sub", 1),
    close: (state) => state.push("bbcode_sub_close", "sub", -1),
  },
  sup: {
    kind: "flow",
    open: (state) => state.push("bbcode_sup_open", "sup", 1),
    close: (state) => state.push("bbcode_sup_close", "sup", -1),
  },
};

export { CORE_SPECS };
