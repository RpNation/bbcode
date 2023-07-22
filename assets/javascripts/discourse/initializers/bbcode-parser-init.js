import "discourse/plugins/BBCode/bbcode-parser.min";

export default {
  name: "bbcode-parser-init",
  initialize() {
    console.log(globalThis);
    console.log(bbcodeParser);
  },
};
