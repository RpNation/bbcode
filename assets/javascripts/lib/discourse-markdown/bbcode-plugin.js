/**
 * Processes inputted BBCode string using custom configured 3rd party library (see /bbcode-src)
 * @param {string} raw content to preprocess into HTML
 * @returns processed HTML string to pass into markdown-it
 */
function preprocessor(raw, opts, previewing = false) {
  // eslint-disable-next-line no-undef
  if (!bbcodeParser) {
    // parser doesn't exist. Something horrible has happened and somehow the parser wasn't imported/initialized
    // give up and send it straight back.
    // eslint-disable-next-line no-console
    console.warn(
      "Attempted to get the bbcode parser: does not exist. Defaulting to standard markdown-it.",
      "\ncalled on: \n",
      raw,
    );
    return [raw, {}];
  }
  const parser = globalThis.bbcodeParser.RpNBBCode;
  opts.previewing = previewing;

  const processed = parser(raw, opts);
  return [processed.html, processed.tree.options.data];
}

/**
 * Processes the output of both the markdown-it and the bbcode parser, concatenating additional content if necessary
 * @param {string} raw processed string
 * @param {boolean} previewing flag
 * @param {any} data from preprocessor
 * @returns processed string
 */
function postprocessor(raw, previewing = false, data = {}) {
  // eslint-disable-next-line no-undef
  if (!bbcodeParser) {
    // parser doesn't exist. Something horrible has happened and somehow the parser wasn't imported/initialized
    // give up and send it straight back.
    // eslint-disable-next-line no-console
    console.warn(
      "Attempted to get the bbcode parser: does not exist. Defaulting to standard markdown-it.",
      "\ncalled on: \n",
      raw,
    );
    return raw;
  }
  // preview auto clear doesn't check against the live dom, so if a onebox is at the end of the post,
  // it won't be cleared and could cause a fatal error
  const append = previewing ? '<div style="display:none;"></div>' : "";
  return globalThis.bbcodeParser.postprocess(raw, data) + append;
}

/**
 * Parses the entire string, including markdown and bbcode
 * @param {string} content the raw string to parse
 * @param {any} md the original markdown-it renderer
 * @param {any} engine the markdown-it engine
 * @param {any} preprocessor_options options to pass to the preprocessor and bbcode parser
 * @param {boolean} previewing flag
 * @returns completely parsed string
 */
function render(content, md, engine, preprocessor_options, previewing = false) {
  const [preprocessed, data] = preprocessor(content, preprocessor_options, previewing);
  data.toRerender?.forEach((uuid) => {
    const raw = data.hoistMap[uuid];
    if (raw) {
      data.hoistMap[uuid] = render(raw, md, engine, preprocessor_options, previewing);
    }
  });
  const processed = md.apply(engine, [preprocessed]);
  const postprocessed = postprocessor(processed, previewing, data);
  return postprocessed;
}

export function setup(helper) {
  if (!helper.markdownIt) {
    return;
  }

  helper.registerOptions((opts, siteSettings) => {
    opts.features["bbcode-parser"] = siteSettings.bbcode_enabled;
    if (opts.engine || !siteSettings.bbcode_enabled) {
      return;
    }
    //Add check site settings for options to send to RpNBBCode
    let preprocessor_options = {
      preserveWhitespace:
        siteSettings.preserve_whitespace && !siteSettings.discourse_normalize_whitespace,
    };

    Object.defineProperty(opts, "engine", {
      configurable: true,
      set(engine) {
        const md = engine.render;
        engine.set({ breaks: false }); // disable breaks. Let BBob handle line breaks.

        engine.render = function (raw) {
          if (engine.options?.discourse?.featuresOverride !== undefined) {
            // if featuresOverride is set, we're in a chat message and should not preprocess
            return md.apply(this, [raw]);
          }
          return render(
            raw,
            md,
            engine,
            preprocessor_options,
            engine.options?.discourse?.previewing,
          );
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

  helper.registerPlugin((md) => {
    // disable paragraph rendering
    md.renderer.rules.paragraph_open = function () {
      return "";
    };
    md.renderer.rules.paragraph_close = function () {
      return "";
    };

    // this rule is where an indent (space/indent) is converted to a code block
    // rarely used in the wild, but it's a common source of confusion
    md.disable("code");
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
    "span.bb-divide",
    "span.bb-highlight",
    "span.bb-inline-spoiler",
    "span.bb-pindent",
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
