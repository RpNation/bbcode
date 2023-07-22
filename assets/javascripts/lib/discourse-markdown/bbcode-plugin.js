function externalFunctionTest(raw) {
  console.log(bbcodeParser.RpNBBCode(raw).html);
  return "injected" + raw;
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
          const preprocessed = externalFunctionTest(raw);
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

  // console.log(helper.getOptions().engine);

  helper.allowList(["div.mermaid"]);
}

// copied helper function from mermaid https://github.com/unfoldingWord/discourse-mermaid/blob/master/assets/javascripts/discourse-markdown/discourse-mermaid.js.es6
// export function setup(helper) {
//   if (!helper.markdownIt) { return; }

//   helper.registerOptions((opts, siteSettings) => {
//     opts.features["bbcode-parser"] = siteSettings.discourse_bbcode_enabled;
//     console.log(opts);
//   });

//   helper.allowList(["div.mermaid"]);

//   console.log('called here!');

//   helper.registerPlugin(md => {
//     md.inline.bbcode.ruler.push("mermaid",{
//       tag: "mermaid",

//       replace: function(state, tagInfo, content) {
//         const token = state.push("html_raw", '', 0);
//         const escaped = state.md.utils.escapeHtml(content);
//         token.content = `<div class="mermaid">\n${escaped}\n</div>\n`;
//         return true;
//       }
//     });
//   });
// }
