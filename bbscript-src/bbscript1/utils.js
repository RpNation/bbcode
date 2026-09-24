/** @typedef {import('./processor').bbscriptOptions} bbscriptOptions */
import { readVariable } from "../scope";

/**
 * @typedef {Object.<string, bbscriptFunc>} bbscriptFuncMap
 */
/**
 * @typedef {Object} bbscriptFunc
 * @property {{types: bbscriptParamTypes[], default?: (number|string|null)}} params
 * @property {bbscriptFunctionCallback} func
 */
/**
 * @callback bbscriptFunctionCallback
 * @param {bbscriptOptions} options
 * @param {...any} args
 * @returns {(void | string | boolean | number | Promise<void> | bbscriptStop)}
 */
/**
 * @typedef {Object} bbscriptStop
 * @property {'stop'} msg
 */

export const bbscriptParamTypes = Object.freeze({
  Function: Symbol("Function"),
  String: Symbol("String"),
  Identifier: Symbol("Identifier"),
  Int: Symbol("Int"),
});

/**
 * @param {unknown} input
 * @returns {asserts input is bbscriptStop}
 */
export const isStop = (input) => {
  return (
    typeof input === "object" &&
    Object.getOwnPropertyNames(input).includes("msg") &&
    input.msg === "stop"
  );
};

/**
 * @typedef {Object} astNode
 * @property {string} name
 * @property {(astNode|string|number)[]} params
 */

/**
 * @param {unknown} input
 * @returns {asserts input is astNode}
 */
export const isAstNode = (input) => {
  return (
    typeof input === "object" &&
    Object.getOwnPropertyNames(input).every((v) =>
      ["name", "params"].includes(v)
    )
  );
};
/**
 * Process input string to produce either a string or the associated data if it is a variable
 * @param {string | number} str input string. Either a string or an identifier
 * @param {bbscriptOptions} options
 * @returns {string} string value
 */
export const getStringVal = (str, options) => {
  if (typeof str === "string" && str.match(/^_(.*)_$/)) {
    // is identifier
    const name = variableName(str);
    return readVariable(options, name) ?? (name || str);
  }
  if (typeof str === "string") {
    str = str.replace(
      /\$\{(\w+)\}/g,
      (match, name) => readVariable(options, name) ?? match
    );
  }
  return str;
};
/**
 * The parser marks identifiers as `_name_`; variables are stored by `name`,
 * which is how bbscript2 sees them too.
 * @param {string} identifier
 * @returns {string}
 */
export const variableName = (identifier) => identifier.slice(1, -1);
