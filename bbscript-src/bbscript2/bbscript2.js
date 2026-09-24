/** @typedef {import('./processor').BBScriptOptions} BBScriptOptions */
import { BBScriptParser } from "./parser";
import { BBScriptProcessor as BBScript2Processor } from "./processor";
import { bbscriptFunctions } from "./functions";
/**
 * @returns {{ processor: BBScript2Processor; parser: BBScriptParser; }}
 */
export function initBBScript2() {
  return {
    processor: new BBScript2Processor(bbscriptFunctions),
    parser: new BBScriptParser(),
  };
}
