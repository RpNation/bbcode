// import "discourse/plugins/BBCode/bbcode-parser.min";

// const bbcodeParser = window.bbcodeParser;

/**
 * Processes inputted BBCode string using custom configured 3rd party library (see /bbcode-src)
 * @param {string} raw content to preprocess into HTML
 * @returns processed HTML string to pass into markdown-it
 */
function preprocessor(raw) {
  console.warn(...Object.getOwnPropertyNames(globalThis));
  try {
    console.warn(bbcodeParser.RpNBBCode("hello").html);
  } catch (e) {
    console.warn(e.toString());
    Object.getOwnPropertyNames(globalThis);
  }
  if (!bbcodeParser) {
    // parser doesn't exist. Something horrible has happened and somehow the parser wasn't imported/initialized
    // give up and send it straight back.
    console.warn(
      "Attempted to get the bbcode parser: does not exist. Defaulting to standard markdown-it.",
      "\ncalled on: \n",
      raw
    );
    console.log(globalThis);
    return raw;
  }
  const parser = globalThis.bbcodeParser.RpNBBCode;

  const processed = parser(raw);
  console.log(processed.html);
  return processed.html;
}

export function setup(helper) {
  if (!helper.markdownIt) {
    return;
  }

  // console.log(globalThis);

  helper.registerOptions((opts, siteSettings) => {
    opts.features["bbcode-parser"] = siteSettings.discourse_bbcode_enabled;
    if (opts.engine || !siteSettings.discourse_bbcode_enabled) {
      return;
    }

    Object.defineProperty(opts, "engine", {
      configurable: true,
      set(engine) {
        // console.log('engine created?');
        // console.log(engine);
        // console.log(engine.render);
        const md = engine.render;
        engine.render = function (raw) {
          // console.log(raw);
          const preprocessed = preprocessor(raw);
          return md.apply(this, [preprocessed]);
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

  helper.allowList(["div.mermaid"]);
}
