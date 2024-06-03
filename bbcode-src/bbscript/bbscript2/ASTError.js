/** @typedef {import('./AST').ASTNode} ASTNode */
/** @extends Error */
export class ASTError extends Error {
  /** @type {ASTNode | null} */
  node;

  /**
   * @param {ASTNode | null} node
   * @param {string} message
   */
  constructor(node, message) {
    super(message);
    this.name = "ASTError";
    this.node = node;
  }
  /**
   * @public
   * @param {string} text
   * @returns {string}
   */
  format(text) {
    if (this.node !== null) {
      const details = this.node.findInText(text);
      this.message += `: ${details.text} (line ${details.line}, column ${details.column})`;
    }
    return this.message;
  }
}
