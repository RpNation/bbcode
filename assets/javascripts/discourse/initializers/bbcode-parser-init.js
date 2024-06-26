import loadscript from "discourse/lib/load-script";

export default {
  name: "bbcode-parser-init",
  initialize() {
    if (window.bbcodeParser) {
      return;
    } else {
      loadscript("/assets/bundled/bbcode-parser.min.js").then(() => {
        // eslint-disable-next-line no-console
        console.info("BBCode parser loaded for preview.");
      });
    }
  },
};
