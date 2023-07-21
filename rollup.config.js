import { nodeResolve } from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";

export default {
  input: "bbcode-src/index.js",
  output: {
    file: "assets/javascripts/discourse/lib/bbcode-parser.min.js",
    format: "es",
    sourcemap: true,
  },
  plugins: [
    nodeResolve(),
    terser({ format: { preamble: "/* Source code in bbcode-src */" } }),
  ],
  watch: {
    include: "bbcode-src/**",
  },
};
