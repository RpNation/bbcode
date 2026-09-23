// BBCode+ data tags: [class] and [animation] add CSS and [script] adds a
// script, all scoped to the post and emitted once as templates at the top of
// it (see bbcodePlusTemplates); [fa] is an icon. Their content is never parsed
// as bbcode.

import { defineTags } from "./define";
import { findClose, parseLooseTag } from "./scanner";
import { guidFor } from "./tokens";

const CLASS_STATES = [
  "hover",
  "focus",
  "active",
  "focus-within",
  "focus-visible",
];
const CSS_LENGTH_RE = /^[0-9]+[a-z]+$/;
const SCRIPT_EVENTS = [
  "init",
  "click",
  "change",
  "input",
  "dblclick",
  "mouseenter",
  "mouseleave",
  "scroll",
];
const FA_VARIABLES = [
  "primary-color",
  "secondary-color",
  "primary-opacity",
  "secondary-opacity",
  "rotate-angle",
];

// braces and brackets can't break out of the rule they are written in
const cssBody = (text) => text.replaceAll(/[[\]{}]/g, "");

const styles = (state) => (state.env.bbcodeStyles ||= []);

function escapeAttr(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

// The [keyframe] tags directly inside an [animation]; anything else is ignored
function keyframes(content) {
  const isKeyframe = (tag) => tag === "keyframe";
  const re = /\[keyframe(?=[\]=\s])/gi;
  const frames = [];
  let match;
  while ((match = re.exec(content))) {
    const info = parseLooseTag(content, match.index, isKeyframe);
    const close =
      info &&
      findClose(content, match.index + info.length, "keyframe", isKeyframe);
    if (!close) {
      continue;
    }
    const ident = info.attrs._default || "";
    const body = cssBody(content.slice(match.index + info.length, close.start));
    frames.push(`${ident}${/^\d+$/.test(ident) ? "%" : ""}{ ${body} }`);
    re.lastIndex = close.end;
  }
  return frames;
}

const PLUS_TAGS = defineTags({
  class: {
    content: "literal",
    render(state, content, { attrs }) {
      const name = attrs.name || attrs._default;
      if (!name) {
        return;
      }
      const suffix = guidFor(state);
      const pseudo = attrs.state?.toLowerCase();
      const selector = attrs.selector
        ? attrs.selector.replace(/[,{}\\\n]/g, "")
        : CLASS_STATES.includes(pseudo)
          ? `:${pseudo}`
          : "";
      const media = ["min", "max"]
        .filter((bound) => CSS_LENGTH_RE.test(attrs[`${bound}Width`] || ""))
        .map((bound) => `(${bound}-width: ${attrs[`${bound}Width`]})`);
      let css = `.${name}__${suffix}${selector} {${cssBody(content.replaceAll("{post_id}", suffix))}}`;
      if (media.length) {
        css = `@media ${media.join(" and ")} {${css}}`;
      }
      styles(state).push(css);
    },
  },

  animation: {
    content: "literal",
    render(state, content, { attrs }) {
      const name = attrs._default || "";
      styles(state).push(
        `@keyframes ${guidFor(state)}${name} { ${keyframes(content).join("\n")} }`
      );
    },
  },

  script: {
    content: "literal",
    render(state, content, { attrs }) {
      const on = attrs.on?.toLowerCase();
      (state.env.bbcodeScripts ||= []).push({
        id: guidFor(state),
        class: attrs.class || "",
        on: SCRIPT_EVENTS.includes(on) ? on : "init",
        version: attrs.version || "",
        content,
      });
    },
  },

  fa: {
    content: "literal",
    render(state, content, { attrs }) {
      const style = [
        attrs.style,
        ...FA_VARIABLES.filter((name) => attrs[name]).map(
          (name) => `--fa-${name}: ${attrs[name]}`
        ),
      ]
        .map((declaration) => declaration?.trim().replace(/;$/, ""))
        .filter(Boolean)
        .join("; ");
      state.push("bbcode_fa_open", "i", 1).attrSet("data-bbcode-fa", "");
      const icon = state.push("bbcode_fa_icon_open", "i", 1);
      icon.attrSet("class", content.trim());
      icon.attrSet("style", style);
      icon.attrSet("data-fa-transform", attrs["fa-transform"] || "");
      state.push("bbcode_fa_icon_close", "i", -1);
      state.push("bbcode_fa_close", "i", -1);
    },
  },
});

// The templates holding the post's [class]/[animation] CSS and [script]s
function bbcodePlusTemplates(env) {
  const scripts = (env.bbcodeScripts || []).map(
    (script) =>
      `<template data-bbcode-plus="script" data-bbscript-id="${escapeAttr(script.id)}" data-bbscript-class="${escapeAttr(script.class)}" data-bbscript-on="${escapeAttr(script.on)}" data-bbscript-ver="${escapeAttr(script.version)}">${script.content}</template>`
  );
  const css = env.bbcodeStyles?.length
    ? `<template data-bbcode-plus="class">${env.bbcodeStyles.join("\n")}</template>`
    : "";
  return scripts.join("") + css;
}

export { bbcodePlusTemplates, PLUS_TAGS };
