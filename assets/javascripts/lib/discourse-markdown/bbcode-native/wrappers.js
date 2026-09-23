// Tags that are a fixed piece of HTML around their content, built from one
// shared `wrapperSpec` helper: alignment/box tags, progress bars, mail,
// block, size/font/color (which switch between an inline span and a block
// div depending on where they sit), and similar.

import { isBlockState } from "./tokens";

// Tags that are a fixed piece of HTML around their content. `build` returns the
// elements that open before the content and, optionally, what follows it: "/"
// closes the innermost open element. `whole` elements are emitted complete,
// with optional text.
const el = (tag, attrs = {}) => ({ tag, attrs });
const whole = (tag, attrs = {}, text = "") => ({
  tag,
  attrs,
  whole: true,
  text,
});

function wrapperSpec(kind, build) {
  const push = (state, { tag, attrs, whole: isWhole, text }, pending) => {
    const token = state.push(`bbcode_${tag}_open`, tag, 1);
    for (const [name, value] of Object.entries(attrs)) {
      token.attrSet(name, value ?? "");
    }
    if (isWhole) {
      if (text) {
        state.push("text", "", 0).content = text;
      }
      state.push(`bbcode_${tag}_close`, tag, -1);
    } else {
      pending.push(tag);
    }
    return token;
  };

  return {
    kind,
    open(state, info) {
      const pending = [];
      const { open } = build(info.attrs._default, info, isBlockState(state));
      return open.map((element) => push(state, element, pending))[0];
    },
    close(state, info) {
      const { open, after } = build(
        info.attrs._default,
        info,
        isBlockState(state)
      );
      const pending = open
        .filter((element) => !element.whole)
        .map(({ tag }) => tag);
      for (const item of after || pending.map(() => "/")) {
        if (item === "/") {
          const tag = pending.pop();
          state.push(`bbcode_${tag}_close`, tag, -1);
        } else {
          push(state, item, pending);
        }
      }
    },
  };
}

const div = (attrs) => ({ open: [el("div", attrs)] });
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
const BLOCK_OPTIONS = [
  ...["block", "dice", "dice10", "setting", "warning", "storyteller"],
  ...["announcement", "important", "question", "encounter", "information"],
  ...["character", "treasure"],
];

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

// The client adds one stylesheet link per distinct `data-font` in a post, so
// nothing needs to be collected here.
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

// Inline styling tags. Around several lines they wrap block content in a div;
// on a single line they stay a span inside the paragraph.
const SPANNING = { spansLines: true };

// XenForo drops the line break right after these tags' close
const TRIM_AFTER = { trimAfter: true };

const PRINT_OPTIONS = ["print", "line", "graph", "parchment"];

const WRAPPERS = {
  left: ["container", () => div({ class: "bb-left" })],
  center: ["container", () => div({ class: "bb-center" })],
  right: ["container", () => div({ class: "bb-right" })],
  centerblock: [
    "container",
    (value) => div({ style: `margin: 0 auto; width: ${value || "50"}%` }),
  ],
  check: [
    "container",
    (value) => div({ class: "bb-check", "data-type": value || "dot" }),
    TRIM_AFTER,
  ],
  side: [
    "container",
    (value) => div({ class: "bb-side", "data-side": value || "left" }),
    TRIM_AFTER,
  ],
  newspaper: ["container", () => div({ class: "bb-newspaper" }), TRIM_AFTER],
  justify: ["container", () => div({ class: "bb-justify" }), TRIM_AFTER],
  ooc: ["container", () => div({ class: "bb-ooc" }), TRIM_AFTER],
  border: [
    "container",
    (value) => div({ style: `border: ${value};`, class: "bb-border" }),
  ],
  imagefloat: [
    "container",
    (value) => div({ class: `bb-float-${value || ""}` }),
    TRIM_AFTER,
  ],
  row: ["container", () => div({ class: "bb-row" })],
  column: [
    "container",
    (value) => {
      const span = value || "8";
      return div({
        class: "bb-column",
        "data-span": span.startsWith("span")
          ? `column-width-${span}`
          : `column-width-span${span}`,
      });
    },
  ],
  print: [
    "container",
    (value) => {
      const option = (value || "print").toLowerCase();
      const known = PRINT_OPTIONS.includes(option) ? option : "print";
      return div({
        class: known === "print" ? "bb-print" : `bb-print-${known}`,
      });
    },
    TRIM_AFTER,
  ],
  progress: ["container", progress("bb-progress")],
  thinprogress: ["container", progress("bb-progress-thin")],
  note: [
    "container",
    () => ({
      open: [
        el("div", { class: "bb-note" }),
        whole("div", { class: "bb-note-tape" }),
        el("div", { class: "bb-note-content" }),
      ],
      after: [whole("div", { class: "bb-note-footer" }), "/", "/"],
    }),
  ],
  fieldset: [
    "container",
    (value) => ({
      open: [
        el("fieldset", { class: "bb-fieldset" }),
        whole("legend", { class: "bb-fieldset-legend" }, value || ""),
        el("div", { class: "bb-fieldset" }),
      ],
    }),
  ],
  block: [
    "container",
    (value) => {
      const option = (value || "block").toLowerCase();
      return div({
        class: "bb-block",
        "data-bb-block": BLOCK_OPTIONS.includes(option) ? option : "block",
      });
    },
    TRIM_AFTER,
  ],
  mail: [
    "container",
    (value, info) => ({
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
  ],
  heightrestrict: [
    "container",
    (value) => {
      const height = parseHeight(value).toString();
      return div(
        height === "0"
          ? { class: "bb-height-restrict" }
          : { class: "bb-height-restrict", style: `height: ${height}px;` }
      );
    },
  ],
  scroll: [
    "container",
    (value) =>
      div({ class: "bb-scroll", style: `height: ${parseHeight(value)}px` }),
  ],
  size: [
    "container",
    (value, info, block) => {
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
    SPANNING,
  ],
  font: [
    "container",
    (value, info, block) => fontElement(info.attrs, block),
    SPANNING,
  ],
  blockquote: [
    "container",
    (value) => ({
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
  ],
  a: [
    "flow",
    (value = "") => ({
      open: [
        el("a", {
          id: `user-anchor-${value.trim()}`,
          name: `user-anchor-${value.trim()}`,
        }),
      ],
    }),
  ],
  goto: [
    "flow",
    (value = "") => ({
      open: [el("a", { href: `#user-anchor-${value.trim()}` })],
    }),
  ],
  inlinespoiler: [
    "flow",
    () => ({ open: [el("span", { class: "bb-inline-spoiler" })] }),
    { trimInside: true },
  ],
  textmessage: [
    "container",
    (value) => ({
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
  ],
  message: [
    "container",
    (value) => {
      const option = (value || "").toLowerCase();
      const them = option === "left" || option === "them";
      return {
        open: [
          el("div", { class: them ? "bb-message-them" : "bb-message-me" }),
          el("div", { class: "bb-message-content" }),
        ],
      };
    },
  ],
  color: [
    "container",
    (value, info, block) => ({
      open: value?.trim()
        ? [el(block ? "div" : "span", { style: `color: ${value}` })]
        : [],
    }),
    SPANNING,
  ],
  // a full-width rule: block-level like [center]/[border], not inline like
  // [color]/[size]
  divide: [
    "container",
    (value) => ({
      open: [
        el("div", {
          class: "bb-divide",
          "data-type": (value || "").toLowerCase(),
        }),
      ],
    }),
    TRIM_AFTER,
  ],
};

const WRAPPER_SPECS = {};
for (const [tag, [kind, build, options]] of Object.entries(WRAPPERS)) {
  WRAPPER_SPECS[tag] = { ...wrapperSpec(kind, build), ...options };
}

export { WRAPPER_SPECS, fontElement };
