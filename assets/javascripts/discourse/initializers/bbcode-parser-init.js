import loadscript from "discourse/lib/load-script";

export default {
  name: "bbcode-parser-init",
  initialize() {
    if (window.bbcodeParser) {
      return;
    }

    loadscript("/assets/bundled/bbcode-parser.min.js").then(() => {
      // eslint-disable-next-line no-console
      console.debug("bbcode-parser loaded");
    });
  },
};
