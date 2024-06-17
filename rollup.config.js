import { nodeResolve } from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";

export default [
  {
    input: "bbcode-src/index.js",
    output: {
      file: "assets/bundled/bbcode-parser.min.js",
      name: "bbcodeParser",
      format: "umd",
      sourcemap: true,
      globals: {
        jquery: "$",
      },
    },
    external: ["jquery"],
    plugins: [nodeResolve(), terser({ format: { preamble: "/* Source code in bbcode-src */" } })],
    watch: {
      include: "bbcode-src/**",
      exclude: "bbcode-src/bbscript/**",
    },
  },
  {
    input: "bbcode-src/bbscript/index.js",
    output: {
      file: "public/javascripts/bbscript-parser.min.js",
      name: "bbscriptParser",
      format: "umd",
      sourcemap: true,
      globals: {
        jquery: "$",
      },
    },
    external: ["jquery"],
    plugins: [
      nodeResolve(),
      terser({ format: { preamble: "/* Source code in bbcode-src/bbscript */" } }),
    ],
    watch: {
      include: "bbcode-src/bbscript/**",
    },
  },
];
