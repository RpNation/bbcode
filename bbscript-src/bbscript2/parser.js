/** @typedef {import('./AST').ASTNode} ASTNode */
import {
  ASTBooleanLiteral,
  ASTFunction,
  ASTIdentifier,
  ASTList,
  ASTNumberLiteral,
  ASTQuotedString,
} from "./AST";
import { ASTError } from "./ASTError";

const ESCAPES = { n: "\n", t: "\t", '"': '"', "\\": "\\" };
const BOOLEANS = { true: true, false: false };
const FUNCTION_NAME_RE = /^[+\-_*/%<>=!a-zA-Z]+$/;
// bare words double as strings, so class names like `is-open` are valid
const IDENTIFIER_RE = /^[A-Za-z_][\w-]*$/;

export class BBScriptParser {
  /** @type {ASTNode[]} */
  ast = [];
  /** @type {string} */
  text = "";
  /** @type {number} */
  length = 0; // separate value for better dev
  /** @type {ASTError[]} */
  errors = [];
  /** @type {number} */
  pos = 0;

  /**
   * Parse input string into AST tree for later processing
   * @param {string} input string to parse
   * @returns {{ ast: ASTNode[]; formattedErrors: string[]; }} AST Tree to be processed in BBScript 2 syntax
   */
  parse(input) {
    this.text = input;
    this.length = this.text.length;
    let fatalError;
    try {
      this.buildAst();
    } catch (e) {
      fatalError = new ASTError(null, e?.message);
    }
    if (fatalError) {
      this.errors.push(fatalError);
    }
    const formattedErrors = this.errors.map((e) => e.format(this.text));
    return {
      ast: this.ast,
      formattedErrors,
    };
  }
  /**
   * Builds an AST
   * @private
   * @returns {ASTNode[]} AST
   */
  buildAst() {
    this.ast = [];
    this.errors = [];
    this.pos = 0;
    let node;
    while (this.pos < this.length) {
      // consume whitespace
      this.consumeWhitespace();
      if (this.pos >= this.length) {
        break;
      }
      // top-level function
      if (this.head() === "(") {
        node = this.processFunctionCall();
      } else {
        this.errors.push(
          new ASTError(null, "Expecting function call, found " + this.head())
        );
        break;
      }
      if (node !== null) {
        this.ast.push(node);
      }
    }
    return this.ast;
  }
  /**
   * Returns the current character at the cursor
   * @private
   * @param {boolean} [throwOnError=true] throw an error if unexpected end of script
   * @returns {string | null} single character string or `null`
   */
  head(throwOnError = true) {
    if (this.pos < this.length) {
      return this.text[this.pos];
    }
    if (throwOnError) {
      throw new Error("Unexpected end of script");
    }
    return null;
  }
  /**
   * Advance the cursor past whitespace and `;` or `//` line comments
   * @private
   * @returns {void}
   */
  consumeWhitespace() {
    while (this.pos < this.length) {
      if (this.isWhitespaceChar()) {
        this.pos++;
      } else if (
        this.text[this.pos] === ";" ||
        this.text.startsWith("//", this.pos)
      ) {
        const lineEnd = this.text.indexOf("\n", this.pos);
        this.pos = lineEnd === -1 ? this.length : lineEnd + 1;
      } else {
        break;
      }
    }
  }
  /**
   * @private
   * @param {string} [char=this.head() || '']
   * @returns {boolean}
   */
  isWhitespaceChar(char = this.head() || "") {
    return /\s/.test(char);
  }
  /**
   * Processes the following substring at the cursor position as a function call
   * @private
   * @returns {ASTFunction} ASTFunction node
   */
  processFunctionCall() {
    const startIdx = this.pos;
    // consume starting parentheses
    this.pos++;
    const name = this.processIdentifier(")", true);
    this.consumeWhitespace();
    const params = [];
    while (this.head() !== ")") {
      this.consumeWhitespace();
      const char = this.head();
      switch (char) {
        case "(":
          params.push(this.processFunctionCall());
          break;
        case '"':
          params.push(this.processString());
          break;
        case "[":
          params.push(this.processList());
          break;
        case ")":
          // end of function.
          break;
        default:
          if (char === "-" || /\d/.test(char || "")) {
            params.push(this.processNumber());
          } else {
            params.push(this.processIdentifier());
          }
          break;
      }
    }
    // consume ending parentheses
    this.pos++;
    const endIdx = this.pos;
    return new ASTFunction(startIdx, endIdx, name, params);
  }
  /**
   * Processes a double quoted string starting at the cursor position into an ASTNode
   * @private
   * @returns {ASTQuotedString}
   */
  processString() {
    let string = "";
    const startIdx = this.pos;
    this.pos++;
    while (this.head() !== '"') {
      let char = this.head();
      if (char === "\\") {
        this.pos++;
        const escaped = this.head();
        char = Object.hasOwn(ESCAPES, escaped)
          ? ESCAPES[escaped]
          : "\\" + escaped;
      }
      string += char;
      this.pos++;
    }
    const endIdx = this.pos;
    this.pos++;
    return new ASTQuotedString(startIdx, endIdx, string);
  }
  /**
   * Processes a bracketed list starting at the cursor position into an ASTNode
   *
   * expects `[item1 item2 item3]`
   * @private
   * @returns {ASTList}
   */
  processList() {
    const startIdx = this.pos;
    this.pos++;
    const items = [];
    while (this.head() !== null) {
      this.consumeWhitespace();
      const char = this.head();
      if (char === "]") {
        break;
      }
      switch (char) {
        case "(":
          items.push(this.processFunctionCall());
          break;
        case '"':
          items.push(this.processString());
          break;
        case "[":
          items.push(this.processList());
          break;
        default:
          if (char === "-" || /\d/.test(char || "")) {
            items.push(this.processNumber("]"));
          } else {
            items.push(this.processIdentifier("]"));
          }
          break;
      }
    }
    // consume closing brace
    this.pos++;
    const endIdx = this.pos;
    return new ASTList(startIdx, endIdx, items);
  }
  /**
   * Processes a number literal starting at the cursor position
   * @private
   * @param {string} [end=')'] terminating characters to stop at
   * @returns {ASTNumberLiteral}
   */
  processNumber(end = ")") {
    const startIdx = this.pos;
    if (this.head() === "-") {
      this.pos++;
    }
    while (!this.isWhitespaceChar() && this.head() !== end) {
      this.pos++;
    }
    const endIdx = this.pos;
    const value = this.text.substring(startIdx, endIdx);
    const numberLiteral = new ASTNumberLiteral(startIdx, endIdx, value);
    if (isNaN(+value)) {
      this.errors.push(new ASTError(numberLiteral, "Invalid number literal"));
    }
    return numberLiteral;
  }
  /**
   * Processes an identifier at the cursor position
   * @private
   * @param {string} [end=')'] end character to stop at
   * @param {boolean} [isFunctionName=false] validate as a function name rather than a variable
   * @returns {ASTIdentifier | ASTBooleanLiteral} `true` and `false` are values, never names
   */
  processIdentifier(end = ")", isFunctionName = false) {
    const nameStartIdx = this.pos;
    while (!this.isWhitespaceChar() && this.head() !== end) {
      this.pos++;
    }
    const nameEndIdx = this.pos;
    const identifier = new ASTIdentifier(
      nameStartIdx,
      nameEndIdx,
      this.text.substring(nameStartIdx, nameEndIdx)
    );
    const kind = isFunctionName ? "function name" : "identifier";
    const pattern = isFunctionName ? FUNCTION_NAME_RE : IDENTIFIER_RE;
    if (!pattern.test(identifier.name)) {
      const problem = identifier.name ? "Invalid" : "Missing";
      this.errors.push(new ASTError(identifier, `${problem} ${kind}`));
    }
    if (!isFunctionName && Object.hasOwn(BOOLEANS, identifier.name)) {
      return new ASTBooleanLiteral(
        nameStartIdx,
        nameEndIdx,
        BOOLEANS[identifier.name]
      );
    }
    return identifier;
  }
}
