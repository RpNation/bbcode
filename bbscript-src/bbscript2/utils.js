/** @typedef {import('./AST').ASTNode} ASTNode */
/** @typedef {import('./processor').BBScriptOptions} BBScriptOptions */

/**
 * @typedef {Object.<string, BBScriptFunc>} BBScriptFuncMap
 */

/**
 * @typedef {(void | string | boolean | number | (BBScriptReturnTypes)[])} BBScriptReturnTypes
 */

/**
 * @callback BBScriptFunc
 * @param {BBScriptOptions} options
 * @param {...any} args
 * @returns {BBScriptReturnTypes}
 */
