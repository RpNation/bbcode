import DiscourseRecommended from "@discourse/lint-configs/eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores([
    "public/javascripts/**",
    "rollup.config.js",
    "bbscript-src/**",
  ]),
  ...DiscourseRecommended,
]);
