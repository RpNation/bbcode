// import { RpNBBCode } from "../lib/bbcode-parser.min.js";

export default {
  name: "bbcode-parser-init",
  initialize() {
    console.log(globalThis);
    // globalThis.bbcodeParser = RpNBBCode;
    // withPluginApi("1.8.0", (api) => {
    //   loadScript("/plugins/BBCode/javascripts/bbcode-parser.min.js").then(
    //     (r) => {
    //       console.log(r);
    //       globalThis.bbcodeParser = r.RpNBBCode;
    //     }
    //   );
    // });
  },
};
