// Tag definitions (format in define.js); section tags are in sections.js and
// BBCode+ data tags in plus.js.

import { defineTags, div, el, whole } from "./define";
import { parseLooseTag } from "./scanner";
import { guidFor } from "./tokens";

const BLOCK_OPTIONS = [
  ...["block", "dice", "dice10", "setting", "warning", "storyteller"],
  ...["announcement", "important", "question", "encounter", "information"],
  ...["character", "treasure"],
];
const PRINT_OPTIONS = ["print", "line", "graph", "parchment"];

const MAX_HEIGHT = 700;
function parseHeight(value) {
  const height = value?.trim() ? value.replace(/[^\d.]/g, "") : 0;
  if (height && height >= 0 && height <= MAX_HEIGHT) {
    return height;
  }
  return height === 0 ? 0 : MAX_HEIGHT;
}

function parseFontSize(input = "") {
  const size = { valid: true };
  const parsed = /(\d+\.?\d?)(px|rem)?/i.exec(input);
  let value = parsed?.[1];
  if (!value) {
    return size;
  }
  size.unit = (parsed[2] || "").toLowerCase();
  const limits = { px: [8, 36], rem: [0.2, 3], "": [1, 7] }[size.unit];
  if (size.unit === "" && input.length !== value.length) {
    size.valid = false;
  } else if (value > limits[1]) {
    value = limits[1];
  } else if (value < limits[0]) {
    value = limits[0];
  }
  size.value = value;
  return size;
}

const WEB_FONTS = [
  ...["arial", "book antiqua", "courier new", "georgia", "tahoma"],
  ...["times new roman", "trebuchet ms", "verdana"],
];
const FONT_WEIGHTS = {
  thin: "100",
  extralight: "200",
  light: "300",
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
  black: "900",
};
const FONT_AXES = ["ital", "opsz", "slnt", "wdth", "wght"];
const FONT_STYLE_RE =
  /(?<named>[a-zA-Z]*)?\s?(?<weight>[0-9]*)?\s?(?<italic>italic)?/;

function fontAxes(attrs) {
  let axes = { ital: 0, wght: 400 };
  if (attrs.style) {
    const groups = FONT_STYLE_RE.exec(attrs.style.trim().toLowerCase()).groups;
    if (groups.italic) {
      axes.ital = 1;
    }
    if (groups.weight && groups.weight >= 0 && groups.weight <= 900) {
      axes.wght = groups.weight;
    } else if (groups.named in FONT_WEIGHTS) {
      axes.wght = FONT_WEIGHTS[groups.named];
    }
    axes = {
      ...axes,
      ...Object.fromEntries(
        Object.entries(attrs).filter(([key]) => FONT_AXES.includes(key))
      ),
    };
  }
  return axes;
}

// the client loads each distinct data-font once per post
function fontElement(attrs, block) {
  const tag = block ? "div" : "span";
  const family = (attrs._default || attrs.family || attrs.name || "").trim();
  if (!family) {
    return { open: [] };
  }
  if (WEB_FONTS.includes(family.toLowerCase())) {
    return { open: [el(tag, { style: `font-family: '${family}'` })] };
  }
  const axes = fontAxes(attrs);
  const sorted = Object.keys(axes).sort();
  const url =
    "https://fonts.googleapis.com/css2?family=" +
    family.replaceAll(" ", "+") +
    ":" +
    sorted.join(",") +
    "@" +
    sorted.map((key) => axes[key]).join(",");
  const custom = Object.entries(axes).filter(
    ([key]) => key !== "wght" && key !== "ital"
  );
  const variation = custom.length
    ? `font-variation-settings: ${custom.map(([key, value]) => `'${key}' ${value}`).join(", ")};`
    : "";
  return {
    open: [
      el(tag, {
        style: `font-family: '${family}'; font-weight: ${axes.wght}; font-style: ${axes.ital === 1 ? "italic" : "normal"}; ${variation}`,
        "data-font": url,
      }),
    ],
  };
}

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

const progress = (className) => (value) => ({
  open: [
    el("div", { class: className }),
    el("div", { class: "bb-progress-text" }),
  ],
  after: [
    "/",
    whole("div", {
      class: "bb-progress-bar",
      style: `width: calc(${value}% - 6px)`,
    }),
    whole("div", { class: "bb-progress-bar-other" }),
    "/",
  ],
});

// Inline styling: a span, or a div around markdown blocks
const styling = (className) => ({
  content: "auto",
  element: (value, info, block) => ({
    open: [el(block ? "div" : "span", { class: className })],
  }),
});

// [h] is [h1] and [sh] is [h2]
const HEADINGS = {
  h: "h1",
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  h5: "h5",
  h6: "h6",
  sh: "h2",
};

const TAGS = defineTags({
  // layout
  div: {
    content: "blocks",
    element(value, info, block, state) {
      const attrs = {};
      if (info.attrs.class?.trim()) {
        const suffix = guidFor(state);
        attrs.class = info.attrs.class
          .trim()
          .split(/\s+/)
          .map((c) => `${c}__${suffix}`)
          .join(" ");
      }
      const style = info.attrs.style || value;
      if (style) {
        attrs.style = style;
      }
      return div(attrs);
    },
  },
  left: { content: "blocks", element: () => div({ class: "bb-left" }) },
  center: { content: "blocks", element: () => div({ class: "bb-center" }) },
  right: { content: "blocks", element: () => div({ class: "bb-right" }) },
  centerblock: {
    content: "blocks",
    element: (value) =>
      div({ style: `margin: 0 auto; width: ${value || "50"}%` }),
  },
  check: {
    content: "blocks",
    element: (value) => div({ class: "bb-check", "data-type": value || "dot" }),
    trimAfter: true,
  },
  side: {
    content: "blocks",
    element: (value) => div({ class: "bb-side", "data-side": value || "left" }),
    trimAfter: true,
  },
  newspaper: {
    content: "blocks",
    element: () => div({ class: "bb-newspaper" }),
    trimAfter: true,
  },
  justify: {
    content: "blocks",
    element: () => div({ class: "bb-justify" }),
    trimAfter: true,
  },
  ooc: {
    content: "blocks",
    element: () => div({ class: "bb-ooc" }),
    trimInside: true,
    trimAfter: true,
  },
  border: {
    content: "blocks",
    element: (value) => div({ style: `border: ${value};`, class: "bb-border" }),
  },
  imagefloat: {
    content: "blocks",
    element: (value) => div({ class: `bb-float-${value || ""}` }),
    trimAfter: true,
  },
  row: { content: "blocks", element: () => div({ class: "bb-row" }) },
  column: {
    content: "blocks",
    element(value) {
      const span = value || "8";
      return div({
        class: "bb-column",
        "data-span": span.startsWith("span")
          ? `column-width-${span}`
          : `column-width-span${span}`,
      });
    },
  },
  heightrestrict: {
    content: "blocks",
    element(value) {
      const height = parseHeight(value).toString();
      return div(
        height === "0"
          ? { class: "bb-height-restrict" }
          : { class: "bb-height-restrict", style: `height: ${height}px;` }
      );
    },
  },
  scroll: {
    content: "blocks",
    element: (value) =>
      div({ class: "bb-scroll", style: `height: ${parseHeight(value)}px` }),
  },
  // a full-width rule, so a block
  divide: {
    content: "blocks",
    element: (value) =>
      div({ class: "bb-divide", "data-type": (value || "").toLowerCase() }),
    trimAfter: true,
  },
  // a block around one run of text, even across blank lines
  bg: {
    content: "text",
    element: (value) =>
      div({ class: "bb-background", style: `background-color: ${value};` }),
  },

  // boxes
  spoiler: {
    content: "blocks",
    element: (value) => ({
      open: [
        el("details", { class: "bb-spoiler" }),
        whole("summary", {}, "Spoiler" + (value ? `: ${value}` : "")),
        el("div", { class: "bb-spoiler-content" }),
      ],
    }),
    trimInside: true,
    trimAfter: true,
  },
  print: {
    content: "blocks",
    element(value) {
      const option = (value || "print").toLowerCase();
      const known = PRINT_OPTIONS.includes(option) ? option : "print";
      return div({
        class: known === "print" ? "bb-print" : `bb-print-${known}`,
      });
    },
    trimAfter: true,
  },
  progress: {
    content: "blocks",
    element: progress("bb-progress"),
    trimInside: true,
  },
  thinprogress: {
    content: "blocks",
    element: progress("bb-progress-thin"),
    trimInside: true,
  },
  note: {
    content: "blocks",
    element: () => ({
      open: [
        el("div", { class: "bb-note" }),
        whole("div", { class: "bb-note-tape" }),
        el("div", { class: "bb-note-content" }),
      ],
      after: [whole("div", { class: "bb-note-footer" }), "/", "/"],
    }),
  },
  fieldset: {
    content: "blocks",
    element: (value) => ({
      open: [
        el("fieldset", { class: "bb-fieldset" }),
        whole("legend", { class: "bb-fieldset-legend" }, value || ""),
        el("div", { class: "bb-fieldset" }),
      ],
    }),
  },
  block: {
    content: "blocks",
    element(value) {
      const option = (value || "block").toLowerCase();
      return div({
        class: "bb-block",
        "data-bb-block": BLOCK_OPTIONS.includes(option) ? option : "block",
      });
    },
    trimAfter: true,
  },
  mail: {
    content: "blocks",
    element: (value, info) => ({
      open: [
        el("div", {
          class: "bb-email",
          "data-bb-email": (info.attrs.type || "send").toLowerCase(),
        }),
        whole("div", { class: "bb-email-header" }),
        whole(
          "div",
          { class: "bb-email-address" },
          info.attrs.person || "Unknown"
        ),
        whole(
          "div",
          { class: "bb-email-subject" },
          info.attrs.subject || "Empty"
        ),
        el("div", { class: "bb-email-content" }),
      ],
      after: [
        "/",
        el("div", { class: "bb-email-footer" }),
        whole("div", { class: "bb-email-button" }),
        "/",
        "/",
      ],
    }),
  },
  blockquote: {
    content: "blocks",
    element: (value) => ({
      open: [
        el("div", { class: "bb-blockquote" }),
        whole("div", { class: "bb-blockquote-left" }),
        el("div", { class: "bb-blockquote-content" }),
      ],
      after: [
        whole(
          "div",
          { class: "bb-blockquote-speaker" },
          value ? `- ${value}` : ""
        ),
        "/",
        whole("div", { class: "bb-blockquote-right" }),
        "/",
      ],
    }),
    trimInside: true,
  },
  textmessage: {
    content: "blocks",
    element: (value) => ({
      open: [
        el("div", { class: "bb-textmessage" }),
        whole(
          "div",
          { class: "bb-textmessage-name" },
          value?.trim() || "Recipient"
        ),
        el("div", { class: "bb-textmessage-overflow" }),
        el("div", { class: "bb-textmessage-content" }),
      ],
    }),
  },
  message: {
    content: "blocks",
    element(value) {
      const option = (value || "").toLowerCase();
      const them = option === "left" || option === "them";
      return {
        open: [
          el("div", { class: them ? "bb-message-them" : "bb-message-me" }),
          el("div", { class: "bb-message-content" }),
        ],
      };
    },
  },
  ...Object.fromEntries(
    Object.entries(HEADINGS).map(([tag, heading]) => [
      tag,
      { content: "blocks", element: () => ({ open: [el(heading)] }) },
    ])
  ),

  // text styling
  b: styling("bbcode-b"),
  i: styling("bbcode-i"),
  u: styling("bbcode-u"),
  s: styling("bbcode-s"),
  pindent: styling("bb-pindent"),
  highlight: styling("bb-highlight"),
  color: {
    content: "auto",
    element: (value, info, block) => ({
      open: value?.trim()
        ? [el(block ? "div" : "span", { style: `color: ${value}` })]
        : [],
    }),
  },
  size: {
    content: "auto",
    element(value, info, block) {
      const size = parseFontSize(value);
      if (!size.valid || size.value === undefined) {
        return { open: [] };
      }
      return {
        open: [
          el(
            block ? "div" : "span",
            size.unit
              ? { style: `font-size: ${size.value}${size.unit}` }
              : { "data-size": size.value }
          ),
        ],
      };
    },
  },
  font: {
    content: "auto",
    element: (value, info, block) => fontElement(info.attrs, block),
  },
  sub: { content: "inline", element: () => ({ open: [el("sub")] }) },
  sup: { content: "inline", element: () => ({ open: [el("sup")] }) },
  inlinespoiler: {
    content: "inline",
    element: () => ({ open: [el("span", { class: "bb-inline-spoiler" })] }),
    trimInside: true,
  },
  a: {
    content: "inline",
    element: (value = "") => ({
      open: [
        el("a", {
          id: `user-anchor-${value.trim()}`,
          name: `user-anchor-${value.trim()}`,
        }),
      ],
    }),
  },
  goto: {
    content: "inline",
    element: (value = "") => ({
      open: [el("a", { href: `#user-anchor-${value.trim()}` })],
    }),
  },

  // line breaks
  // [br][/br] pairs are how existing content writes a line break
  br: {
    content: "inline",
    open: (state) => state.push("hardbreak", "br", 0),
  },
  nobr: { content: "blocks", lineBreaks: false },

  // literal content
  plain: {
    content: "literal",
    render(state, content) {
      content.split("\n").forEach((line, index) => {
        if (index) {
          state.push("hardbreak", "br", 0);
        }
        // not "text", which emoji, mentions, hashtags and links are made from
        state.push("bbcode_plain_text", "", 0).content = line;
      });
    },
  },
  icode: {
    content: "literal",
    render(state, content) {
      // without the tags' own newlines, as core does for [code]
      state.push("code_inline", "code", 0).content = content.replace(
        /^\n|\n$/g,
        ""
      );
    },
  },
  // An HTML comment, as XenForo renders it. The sanitizer drops comments, so
  // this is a <template> that lib/bb_code/comments.rb turns into one when the
  // post is cooked. Fonts named inside still load: authors use [font] in a
  // comment just for that.
  comment: {
    content: "literal",
    inlineOnly: true,
    render(state, content) {
      for (const url of commentFonts(content)) {
        state
          .push("bbcode_font_loader_open", "span", 1)
          .attrSet("data-font", url);
        state.push("bbcode_font_loader_close", "span", -1);
      }
      state.push("html_inline", "", 0).content =
        `<template data-bbcode-comment>${state.md.utils.escapeHtml(content)}</template>`;
    },
  },
});

export { TAGS };
