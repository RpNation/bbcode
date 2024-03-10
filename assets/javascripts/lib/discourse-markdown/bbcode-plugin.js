/**
 * Processes inputted BBCode string using custom configured 3rd party library (see /bbcode-src)
 * @param {string} raw content to preprocess into HTML
 * @returns processed HTML string to pass into markdown-it
 */
function preprocessor(raw, opts) {
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

  const processed = parser(raw, opts);
  return [processed.html, processed.tree.options.data];
}

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
          const [preprocessed, data] = preprocessor(raw, preprocessor_options);
          const processed = md.apply(this, [preprocessed]);
          const postprocessed = postprocessor(
            processed,
            engine.options?.discourse?.previewing,
            data,
          );
          return postprocessed;
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
  });

  helper.allowList([
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
    "div.column-width-span1",
    "div.column-width-span2",
    "div.column-width-span3",
    "div.column-width-span4",
    "div.column-width-span5",
    "div.column-width-span6",
    "div.column-width-span7",
    "div.column-width-span8",
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
    "div.bb-spoiler-content",
    "div[style=*]",
    "fieldset.bb-fieldset",
    "legend.bb-fieldset-legend",
    "details.bb-spoiler",
    "span.bb-divide",
    "span.bb-highlight",
    "span.bb-inline-spoiler",
    "span.bb-pindent",
    "span[style=*]",
    "summary",
  ]);
}
