import { nodeResolve } from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";

export default {
  input: "bbcode-src/index.js",
  output: {
    file: "assets/bundled/bbcode-parser.min.js",
    name: "bbcodeParser",
    format: "umd",
  },
  plugins: [
    nodeResolve(),
    // terser({ format: { preamble: "/* Source code in bbcode-src */" } }),
  ],
  watch: {
    include: "bbcode-src/**",
  },
};
