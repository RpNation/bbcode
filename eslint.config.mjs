import DiscourseRecommended from "@discourse/lint-configs/eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["assets/bundled/**", "public/javascripts/**", "rollup.config.js"]),
  ...DiscourseRecommended,
]);
