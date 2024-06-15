export default {
  name: "bbcode-parser-init",
  initialize() {
    if (window.bbcodeParser) {
      return;
    } else {
      // eslint-disable-next-line no-console
      console.warn("bbcode parser not found. Expected to be loaded via plugin.rb");
    }
  },
};
