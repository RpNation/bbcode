import { nodeResolve } from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";

export default [
  {
    input: "bbscript-src/index.js",
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
      terser({ format: { preamble: "/* Source code in bbscript-src */" } }),
    ],
    watch: {
      include: "bbscript-src/**",
    },
  },
];
