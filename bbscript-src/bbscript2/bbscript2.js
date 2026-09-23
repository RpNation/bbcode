/** @typedef {import('./processor').BBScriptOptions} BBScriptOptions */
import { BBScriptParser } from "./parser";
import { BBScriptProcessor as BBScript2Processor } from "./processor";
import { bbscriptFunctions } from "./functions";
/**
 * @param {any} bbscriptData
 * @returns {{ processor: BBScript2Processor; parser: BBScriptParser; }}
 */
export function initBBScript2(bbscriptData) {
  return {
    processor: new BBScript2Processor(bbscriptFunctions, { data: bbscriptData }),
    parser: new BBScriptParser(),
  };
}
