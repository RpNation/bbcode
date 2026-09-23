/** @typedef {import('./processor.js').bbscriptOptions} bbscript1Options */
import { BBScriptProcessor as BBScript1Processor } from "./processor.js";
import { bbscriptFunctions } from "./functions.js";
/**
 * @param {any} bbscriptData
 * @returns {BBScript1Processor}
 */
export function initBBScript1(bbscriptData) {
  return new BBScript1Processor(bbscriptFunctions, { data: bbscriptData });
}
