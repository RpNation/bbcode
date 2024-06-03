/** @typedef {import('./processor').BBScriptOptions} BBScriptOptions */
/** @typedef {import('./utils').BBScriptReturnTypes} BBScriptReturnTypes */
import { ConsoleLogger } from "../logger";

export class ASTNode {
  /** @type {number} */
  _startIdx;
  /** @type {number} */
  _endIdx;

  /**
   * @param {number} startIdx
   * @param {number} endIdx
   */
  constructor(startIdx, endIdx) {
    this._startIdx = startIdx;
    this._endIdx = endIdx;
  }
  /**
   * @public
   * @returns {number}
   */
  get startIdx() {
    return this._startIdx;
  }
  /**
   * @public
   * @returns {number}
   */
  get endIdx() {
    return this._endIdx;
  }
  /**
   * returns information about the text of the node in the original script
   * @public
   * @param {string} text input string
   * @returns {{ line: number; column: number; text: string; }}
   */
  findInText(text) {
    let line = 1;
    let column = 1;
    for (let i = 0; i < text.length; i++) {
      if (i === this.startIdx) {
        break;
      }
      if (text[i] === "\n") {
        line++;
        column = 0;
      }
      column++;
    }
    return {
      line,
      column,
      text: text.substring(this.startIdx, this.endIdx),
    };
  }
}

/** @extends ASTNode */
export class ASTIdentifier extends ASTNode {
  /** @type {string} */
  _name;

  /**
   * @param {number} startIdx
   * @param {number} endIdx
   * @param {string} name
   */
  constructor(startIdx, endIdx, name) {
    super(startIdx, endIdx);
    this._name = name;
  }
  /**
   * @public
   * @returns {string}
   */
  get name() {
    return this._name;
  }
  /**
   * @public
   * @param {BBScriptOptions} options
   * @returns {any}
   */
  resolveValue(options) {
    if (
      options.callerId &&
      options.data[options.callerId] &&
      options.data[options.callerId][this.name] !== undefined
    ) {
      return options.data[options.callerId][this.name];
    } else {
      return this.name;
    }
  }
}

/** @extends ASTNode */
export class ASTFunction extends ASTNode {
  /** @type {ASTIdentifier} */
  _identifier;
  /** @type {ASTNode[]} */
  _params;

  /**
   * @param {number} startIdx
   * @param {number} endIdx
   * @param {ASTIdentifier} name
   * @param {ASTNode[]} params
   */
  constructor(startIdx, endIdx, name, params) {
    super(startIdx, endIdx);
    this._identifier = name;
    this._params = params;
  }
  /**
   * @public
   * @returns {ASTIdentifier}
   */
  get identifier() {
    return this._identifier;
  }
  /**
   * @public
   * @returns {ASTNode[]}
   */
  get params() {
    return this._params;
  }
  /**
   * Processes and executes a single node
   * @public
   * @param {BBScriptOptions} options bbscript options
   * @returns {BBScriptReturnTypes} returns value if applicable
   */
  resolveValue(options) {
    const functions = options.processor.functions;
    const callable = functions[this.identifier.name];
    if (callable) {
      const args = this.params;
      try {
        return callable(options, ...args);
      } catch (error) {
        ConsoleLogger.warn("BBScript Error", error, this, options);
      }
    }
    ConsoleLogger.info("invalid command", this, options);
  }
}

/** @extends ASTNode */
export class ASTQuotedString extends ASTNode {
  /** @type {string} */
  _string;

  /**
   * @param {number} startIdx
   * @param {number} endIdx
   * @param {string} input
   */
  constructor(startIdx, endIdx, input) {
    super(startIdx, endIdx);
    this._string = input;
  }
  /**
   * @public
   * @returns {string}
   */
  get string() {
    return this._string;
  }
  /**
   * @public
   * @returns {string}
   */
  resolveValue() {
    return this.string;
  }
}

/** @extends ASTNode */
export class ASTList extends ASTNode {
  /** @type {ASTNode[]} */
  _items;
  /**
   * @param {number} startIdx
   * @param {number} endIdx
   * @param {ASTNode[]} elements
   */
  constructor(startIdx, endIdx, elements) {
    super(startIdx, endIdx);
    this._items = elements;
  }
  /**
   * @public
   * @returns {ASTNode[]}
   */
  get items() {
    return this._items;
  }
  /**
   * @public
   * @param {BBScriptOptions} options
   * @returns {(string | number | boolean)[]}
   */
  resolveValue(options) {
    return this.items.map((i) => i.resolveValue(options));
  }
}

/** @extends ASTNode */
export class ASTNumberLiteral extends ASTNode {
  /** @type {string} */
  _value;

  /**
   * @param {number} startIdx
   * @param {number} endIdx
   * @param {string} value
   */
  constructor(startIdx, endIdx, value) {
    super(startIdx, endIdx);
    this._value = value;
  }
  /**
   * @public
   * @returns {string}
   */
  get value() {
    return this._value;
  }
  /**
   * @public
   * @returns {number}
   */
  resolveValue() {
    return +this.value;
  }
}
