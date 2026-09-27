// The sanitizer allowlist for bbcode-native.js's HTML, and a composer preview fix.

export function setup(helper) {
  if (!helper.markdownIt) {
    return;
  }

  helper.registerOptions((opts, siteSettings) => {
    // must match this module's basename, which gates its allowList
    opts.features["bbcode-plugin"] = siteSettings.bbcode_enabled;
    if (opts.engine || !siteSettings.bbcode_enabled) {
      return;
    }

    Object.defineProperty(opts, "engine", {
      configurable: true,
      set(engine) {
        const render = engine.render;
        engine.render = function (raw) {
          const html = render.apply(this, [raw]);
          const discourse = engine.options?.discourse;
          // Preview clearing doesn't check the live DOM, so a onebox ending the
          // post is never cleared and can crash it. Chat (featuresOverride)
          // isn't a preview.
          return discourse?.previewing &&
            discourse.featuresOverride === undefined
            ? html + '<div style="display:none;"></div>'
            : html;
        };
        Object.defineProperty(opts, "engine", {
          configurable: true,
          enumerable: true,
          writable: true,
          value: engine,
        });
      },
    });
  });

  helper.allowList([
    "div.bb-accordion",
    "div.bb-background",
    "div.bb-block",
    "div[data-bb-block=*]",
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
    "div[style=*]",
    "fieldset.bb-fieldset",
    "legend.bb-fieldset-legend",
    "details.bb-slide",
    "details.bb-spoiler",
    "i[data-bbcode-fa]",
    "i[data-fa-transform]",
    "div.bb-divide",
    "span.bb-highlight",
    "span.bb-inline-spoiler",
    "span.bb-pindent",
    "span[style=*]",
    "summary",
    "summary.bb-slide-title",
    "template[data-bbcode-comment]",
    "template[data-bbcode-plus=class]",
    "template[data-bbcode-plus=script]",
    "template[data-bbscript-id=*]",
    "template[data-bbscript-class=*]",
    "template[data-bbscript-on=*]",
    "template[data-bbscript-ver=*]",
  ]);

  helper.allowList({
    custom: (tag, name, value) => {
      // [anchor]
      if (tag === "a" && name === "id" && value.startsWith("user-anchor-")) {
        return true;
      }

      // [tabs]
      if (tag === "input" && name === "type" && value === "radio") {
        return true;
      }
      if (tag === "input" && name === "id" && value.startsWith("tab-")) {
        return true;
      }
      if (
        tag === "input" &&
        name === "name" &&
        value.startsWith("tab-group-")
      ) {
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

      // [accordion]
      if (
        tag === "div" &&
        name === "class" &&
        value.startsWith("bb-accordion")
      ) {
        const validClasses = [
          "bb-accordion",
          "bright",
          "bcenter",
          "bleft",
          "fleft",
          "fright",
        ];
        const classes = value.split(" ");
        return classes.every((c) => validClasses.includes(c));
      }
      if (tag === "details" && name === "open") {
        return true;
      }
      if (tag === "summary" && name === "style") {
        return true;
      }

      // classes scoped by [class]/[div class]
      if (tag === "div" && name === "class" && value.includes("__preview")) {
        return value.split(" ").every((c) => c.endsWith("__preview"));
      }
      if (tag === "div" && name === "class" && value.includes("__post-")) {
        return value.split(" ").every((c) => c.includes("__post-"));
      }

      // [fa]
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
