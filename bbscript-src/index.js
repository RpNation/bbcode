/** @typedef {import('./bbscript1/processor').bbscriptOptions} bbscriptOptions */
/** @typedef {import('./bbscript1/utils').astNode} astNode */
/** @typedef {import('./bbscript2/AST').ASTNode} ASTNode */
/** @typedef {import('./bbscript2/processor').BBScriptOptions} BBScriptOptions */
import { initBBScript1 } from "./bbscript1/bbscript1";
import { initBBScript2 } from "./bbscript2/bbscript2";
import { createStore } from "./scope";
const bbscriptProcessorV1 = initBBScript1();
const { processor: bbscriptProcessorV2, parser: bbscript2Parser } =
  initBBScript2();
// eslint-disable-next-line no-console
console.info("BBCodePlus Addon JS Loaded");

/**
 * @module bbscriptParser
 */
export {
  createStore,
  bbscriptProcessorV1,
  bbscriptProcessorV2,
  bbscript2Parser,
};
