// Keep the BBCode parser inside Discourse's registered Markdown pipeline.
// Its output still passes through the normal sanitizer on both server and client.
export function setup(helper) {
  helper.registerOptions((options, siteSettings) => {
    options.features["bbcode-plugin"] = !!siteSettings.bbcode_enabled;
    options.bbcodePreserveWhitespace =
      siteSettings.preserve_whitespace && !siteSettings.discourse_normalize_whitespace;
  });

  helper.registerPlugin((md) => {
    const parser = globalThis.bbcodeParser;
    if (!parser) {
      throw new Error("The registered BBCode parser asset is missing");
    }

    const parsedTokens = new WeakMap();

    md.core.ruler.before("normalize", "rpn-bbcode", (state) => {
      // Plain Markdown keeps native paragraphs, whitespace and code blocks.
      // Restricted cooks (including chat) do not enable this feature.
      state.env.rpnBBCode = false;
      if (!parser.containsBBCode(state.src)) {
        return;
      }

      const processed = parser.RpNBBCode(state.src, {
        preserveWhitespace: md.options.discourse.bbcodePreserveWhitespace,
        previewing: md.options.discourse.previewing,
      });
      state.src = processed.html;
      state.env.rpnBBCode = true;
      parsedTokens.set(state.tokens, processed.tree.options.data);
    });

    // Legacy layouts indent nested tags for readability. After conversion the
    // generated HTML must not become an indented Markdown code block. Capture
    // the native rule through Ruler's public API while registering the plugin,
    // then keep it enabled for every ordinary Markdown cook.
    const blockRules = md.block.ruler.getRules("");
    md.block.ruler.disable("code", true);
    const withoutCode = new Set(md.block.ruler.getRules(""));
    const nativeCode = blockRules.find((rule) => !withoutCode.has(rule));
    if (nativeCode) {
      md.block.ruler.at("code", (state, ...args) => {
        return !state.env.rpnBBCode && nativeCode(state, ...args);
      });
      md.block.ruler.enable("code");
    }

    for (const name of ["paragraph_open", "paragraph_close", "softbreak"]) {
      const renderRule = md.renderer.rules[name];
      md.renderer.rules[name] = (tokens, index, options, env, renderer) => {
        if (env.rpnBBCode) {
          return name === "softbreak" ? "\n" : "";
        }
        return renderRule
          ? renderRule(tokens, index, options, env, renderer)
          : renderer.renderToken(tokens, index, options);
      };
    }

    // A renderer extension preserves the parser's hoisted code, styles and
    // scripts without intercepting Discourse's engine initialization.
    const render = md.renderer.render;
    md.renderer.render = function (tokens, options, env) {
      const html = render.call(this, tokens, options, env);
      const data = parsedTokens.get(tokens);
      return data ? parser.postprocess(html, data) : html;
    };
  });

  helper.allowList([
    "div.bb-accordion",
    "div.bb-background",
    "table.bb-block",
    "td.bb-block-content",
    "td.bb-block-icon",
    "table[data-bb-block=*]",
    "div.bb-blockquote",
    "div.bb-blockquote-content",
    "div.bb-blockquote-left",
    "div.bb-blockquote-right",
    "div.bb-blockquote-speaker",
    "div.bb-border",
    "div.bb-center",
    "div.bb-check",
    "div.bb-column",
    "div.bb-email",
    "div.bb-email-address",
    "div.bb-email-button",
    "div.bb-email-content",
    "div.bb-email-footer",
    "div.bb-email-header",
    "div.bb-email-subject",
    "div.bb-float-left",
    "div.bb-float-right",
    "div.bb-fieldset",
    "div.bb-height-restrict",
    "div.bb-img",
    "div.bb-justify",
    "div.bb-left",
    "div.bb-newspaper",
    "div.bb-note",
    "div.bb-note-content",
    "div.bb-note-footer",
    "div.bb-note-tape",
    "div.bb-print",
    "div.bb-print-line",
    "div.bb-print-graph",
    "div.bb-print-parchment",
    "div.bb-progress",
    "div.bb-progress-bar",
    "div.bb-progress-other",
    "div.bb-progress-bar-other",
    "div.bb-progress-text",
    "div.bb-progress-thin",
    "div.bb-ooc",
    "div.bb-right",
    "div.bb-row",
    "div.bb-scroll",
    "div.bb-side",
    "div.bb-slide-content",
    "div.bb-spoiler-content",
    "div.bb-tabs",
    "table.bb-table",
    "td.bb-table-footer",
    "input.bb-tab",
    "label.bb-tab-label",
    "div.bb-tab-content",
    "div.bb-textmessage",
    "div.bb-textmessage-name",
    "div.bb-textmessage-overflow",
    "div.bb-textmessage-content",
    "div.bb-message-content",
    "div.bb-message-them",
    "div.bb-message-me",
    "div[data-bbcode-div=true]",
    "div[style=*]",
    "fieldset.bb-fieldset",
    "legend.bb-fieldset-legend",
    "details.bb-slide",
    "details.bb-spoiler",
    "i[data-bbcode-fa]",
    "i[data-fa-transform]",
    "span.bb-divide",
    "span.bb-highlight",
    "span.bb-inline-spoiler",
    "span.bb-pindent",
    "span.bbcode-b",
    "span.bbcode-i",
    "span.bbcode-u",
    "span.bbcode-s",
    "span.hidden",
    "span[style=*]",
    "summary",
    "summary.bb-slide-title",
    "template[data-bbcode-plus=class]",
    "template[data-bbcode-plus=script]",
    "template[data-bbscript-id=*]",
    "template[data-bbscript-class=*]",
    "template[data-bbscript-on=*]",
    "template[data-bbscript-ver=*]",
  ]);

  helper.allowList({
    custom: (tag, name, value) => {
      // custom attr allowlist for anchor tags
      if (tag === "a" && name === "id" && value.startsWith("user-anchor-")) {
        return true;
      }

      if (tag === "div" && name === "data-span") {
        return /^column-width-span\d+$/.test(value);
      }

      if (tag === "table" && name === "data-bb-table-style") {
        return /^(?:(?:none|dotted|dark)(?:-zebra2?)?|zebra2?)$/.test(value);
      }
      if (tag === "tr" && name === "data-bb-table-row") {
        return ["blue", "gray"].includes(value);
      }
      if (["td", "th"].includes(tag) && name === "colspan") {
        return /^\d{1,4}$/.test(value) && Number(value) > 0 && Number(value) <= 1000;
      }

      if (tag === "span" && name === "data-font") {
        return value.startsWith("https://fonts.googleapis.com/css2?");
      }

      // custom attr allowlist for tabs
      if (tag === "input" && name === "type" && value === "radio") {
        return true;
      }
      if (tag === "input" && name === "id" && value.startsWith("tab-")) {
        return true;
      }
      if (tag === "input" && name === "name" && value.startsWith("tab-group-")) {
        return true;
      }
      if (tag === "input" && name === "checked") {
        return true;
      }
      if (tag === "label" && name === "for" && value.startsWith("tab-")) {
        return true;
      }
      if (tag === "label" && name === "style") {
        return true;
      }

      // custom attr allowlist for accordions
      if (tag === "div" && name === "class" && value.startsWith("bb-accordion")) {
        const validClasses = ["bb-accordion", "bright", "bcenter", "bleft", "fleft", "fright"];
        const classes = value.split(" ");
        return classes.every((c) => validClasses.includes(c));
      }
      if (tag === "details" && name === "open") {
        return true;
      }
      if (tag === "summary" && name === "style") {
        return true;
      }

      // custom attr allowlist for div style scripts
      if (tag === "div" && name === "class" && value.includes("__preview")) {
        return value.split(" ").every((c) => c.endsWith("__preview"));
      }
      if (tag === "div" && name === "class" && value.includes("__post-")) {
        return value.split(" ").every((c) => c.includes("__post-"));
      }

      // custom attr allowlist for fontawesome [fa]
      if (tag === "i" && name === "class") {
        return true;
      }
      if (tag === "i" && name === "style") {
        return true;
      }

      return false;
    },
  });
}
