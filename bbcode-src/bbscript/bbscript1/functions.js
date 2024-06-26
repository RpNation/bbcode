/** @typedef {import('./utils').astNode} astNode */
/** @typedef {import('./utils').bbscriptFunc} bbscriptFunc */
/** @typedef {import('./utils').bbscriptFuncMap} bbscriptFuncMap */
/** @typedef {import('./processor').bbscriptOptions} bbscriptOptions */
import $ from "jquery";
import { bbscriptParamTypes, getStringVal, isAstNode } from "./utils";
import { ConsoleLogger } from "../logger";

/**
 * Conditional if then else
 * @type {bbscriptFunc}
 */
export const conditional = {
  params: [
    { types: [bbscriptParamTypes.Function] },
    { types: [bbscriptParamTypes.Function] },
    { types: [bbscriptParamTypes.Function], default: null },
  ],
  func: (options, lhs, rhs, elseBlock) => {
    const result = options.processor.exec(lhs, options);
    if (result) {
      return options.processor.exec(rhs, options);
    } else if (elseBlock) {
      return options.processor.exec(elseBlock, options);
    }
  },
};
/**
 * force stop
 * @type {bbscriptFunc}
 */
export const stop = {
  params: [],
  func: () => {
    return { msg: "stop" };
  },
};
/**
 * Get the Elements wrapped in JQuery for quick JQuery functionality
 * @param {any} el target input string selector
 * @param {bbscriptOptions} options
 * @returns {any}
 */
const getJQueryEl = (el, options) => {
  if (el) {
    el = "." + getStringVal(el, options).trim() + "__" + options.callerId;
  } else {
    el = $(options.target);
  }
  return $(el);
};
export const addClass = {
  params: [
    { types: [bbscriptParamTypes.Identifier] },
    { types: [bbscriptParamTypes.Identifier], default: null },
  ],
  func: (options, newClass, target = "") => {
    newClass = getStringVal(newClass, options) || "";
    newClass &&= newClass + "__" + options.callerId;
    getJQueryEl(target, options).addClass(newClass);
  },
};
export const removeClass = {
  params: [
    { types: [bbscriptParamTypes.Identifier] },
    { types: [bbscriptParamTypes.Identifier], default: null },
  ],
  func: (options, oldClass, target = "") => {
    oldClass = getStringVal(oldClass, options) || "";
    oldClass &&= oldClass + "__" + options.callerId;
    getJQueryEl(target, options).removeClass(oldClass);
  },
};
export const fadeIn = {
  params: [
    { types: [bbscriptParamTypes.Int], default: 1000 },
    { types: [bbscriptParamTypes.Identifier], default: null },
  ],
  func: (options, time = 1000, target) => {
    getJQueryEl(target, options).fadeIn(time);
  },
};
export const fadeOut = {
  params: [
    { types: [bbscriptParamTypes.Int], default: 1000 },
    { types: [bbscriptParamTypes.Identifier], default: null },
  ],
  func: (options, time = 1000, target) => {
    getJQueryEl(target, options).fadeOut(time);
  },
};
export const fadeToggle = {
  params: [
    { types: [bbscriptParamTypes.Int], default: 1000 },
    { types: [bbscriptParamTypes.Identifier], default: null },
  ],
  func: (options, time = 1000, target) => {
    getJQueryEl(target, options).fadeToggle(time);
  },
};
export const hide = {
  params: [{ types: [bbscriptParamTypes.Identifier], default: null }],
  func: (options, target) => {
    getJQueryEl(target, options).hide();
  },
};
export const show = {
  params: [{ types: [bbscriptParamTypes.Identifier], default: null }],
  func: (options, target) => {
    getJQueryEl(target, options).show();
  },
};
export const getText = {
  params: [{ types: [bbscriptParamTypes.Identifier], default: null }],
  func: (options, target) => {
    return getJQueryEl(target, options).text();
  },
};
export const setText = {
  params: [
    {
      types: [
        bbscriptParamTypes.String,
        bbscriptParamTypes.Function,
        bbscriptParamTypes.Identifier,
      ],
    },
    { types: [bbscriptParamTypes.Identifier], default: null },
  ],
  func: (options, input, target) => {
    if (isAstNode(input)) {
      input = options.processor.exec(input, options);
    } else {
      input = getStringVal(input, options);
    }
    getJQueryEl(target, options).text(input);
  },
};
export const slideDown = {
  params: [
    { types: [bbscriptParamTypes.Int], default: 1000 },
    { types: [bbscriptParamTypes.Identifier], default: null },
  ],
  func: (options, time = 1000, target) => {
    getJQueryEl(target, options).slideDown(time);
  },
};
export const slideUp = {
  params: [
    { types: [bbscriptParamTypes.Int], default: 1000 },
    { types: [bbscriptParamTypes.Identifier], default: null },
  ],
  func: (options, time = 1000, target) => {
    getJQueryEl(target, options).slideUp(time);
  },
};
export const slideToggle = {
  params: [
    { types: [bbscriptParamTypes.Int], default: 1000 },
    { types: [bbscriptParamTypes.Identifier], default: null },
  ],
  func: (options, time = 1000, target) => {
    getJQueryEl(target, options).slideToggle(time);
  },
};
const params = [
  {
    types: [
      bbscriptParamTypes.String,
      bbscriptParamTypes.Function,
      bbscriptParamTypes.Int,
      bbscriptParamTypes.Identifier,
    ],
  },
  {
    types: [
      bbscriptParamTypes.String,
      bbscriptParamTypes.Function,
      bbscriptParamTypes.Int,
      bbscriptParamTypes.Identifier,
    ],
  },
];
/**
 * Common evaluate method to process left and right arguments first if they are nested
 * @param {bbscriptOptions} options
 * @param {unknown} lhs
 * @param {unknown} rhs
 * @returns {any[]}
 */
const evaluate = (options, lhs, rhs) => {
  let leftResult;
  let rightResult;
  if (isAstNode(lhs)) {
    leftResult = options.processor.exec(lhs, options);
  } else {
    leftResult = getStringVal(lhs, options);
  }
  if (isAstNode(rhs)) {
    rightResult = options.processor.exec(rhs, options);
  } else {
    rightResult = getStringVal(rhs, options);
  }
  return [leftResult, rightResult];
};
/**
 * is equal to
 * @type {bbscriptFunc}
 */
export const eq = {
  params,
  func: (options, lhs, rhs) => {
    const [leftResult, rightResult] = evaluate(options, lhs, rhs);
    // eslint-disable-next-line eqeqeq
    return leftResult == rightResult;
  },
};
/**
 * is greater than
 * @type {bbscriptFunc}
 */
export const ge = {
  params,
  func: (options, lhs, rhs) => {
    const [leftResult, rightResult] = evaluate(options, lhs, rhs);
    return leftResult > rightResult;
  },
};
/**
 * is greater than or equal to
 * @type {bbscriptFunc}
 */
export const geq = {
  params,
  func: (options, lhs, rhs) => {
    const [leftResult, rightResult] = evaluate(options, lhs, rhs);
    return leftResult >= rightResult;
  },
};
/**
 * is less than
 * @type {bbscriptFunc}
 */
export const le = {
  params,
  func: (options, lhs, rhs) => {
    const [leftResult, rightResult] = evaluate(options, lhs, rhs);
    return leftResult < rightResult;
  },
};
/**
 * is less than or equal to
 * @type {bbscriptFunc}
 */
export const leq = {
  params,
  func: (options, lhs, rhs) => {
    const [leftResult, rightResult] = evaluate(options, lhs, rhs);
    return leftResult >= rightResult;
  },
};
export const random = {
  params: [{ types: [bbscriptParamTypes.Int] }, { types: [bbscriptParamTypes.Int] }],
  func: (options, min, max) => {
    return Math.floor(Math.random() * (max - min + 1) + min);
  },
};
export const print = {
  params: [{ types: [bbscriptParamTypes.String, bbscriptParamTypes.Identifier] }],
  func: (options, args) => {
    ConsoleLogger.log(getStringVal(args, options));
  },
};
/**
 * Set variable
 * @type {bbscriptFunc}
 */
export const set = {
  params: [
    { types: [bbscriptParamTypes.Identifier] },
    { types: [bbscriptParamTypes.Int, bbscriptParamTypes.String, bbscriptParamTypes.Function] },
  ],
  func: (options, id, value) => {
    if (isAstNode(value)) {
      value = options.processor.exec(value, options);
    } else {
      value = getStringVal(value, options);
    }
    const callerId = options.callerId || "";
    if (!(callerId in options.data)) {
      options.data[callerId] = {};
    }
    options.data[callerId][id] = value;
  },
};
export const add = {
  params: [
    {
      types: [
        bbscriptParamTypes.Int,
        bbscriptParamTypes.String,
        bbscriptParamTypes.Identifier,
        bbscriptParamTypes.Function,
      ],
    },
    {
      types: [
        bbscriptParamTypes.Int,
        bbscriptParamTypes.String,
        bbscriptParamTypes.Identifier,
        bbscriptParamTypes.Function,
      ],
    },
  ],
  func: (options, a, b) => {
    if (isAstNode(a)) {
      a = options.processor.exec(a, options);
    } else {
      a = getStringVal(a, options);
    }
    if (isAstNode(b)) {
      b = options.processor.exec(b, options);
    } else {
      b = getStringVal(b, options);
    }
    return a + b;
  },
};
export const dec = {
  params: [
    { types: [bbscriptParamTypes.Identifier] },
    { types: [bbscriptParamTypes.Int], default: 1 },
  ],
  func: (options, id, amount = 1) => {
    try {
      const callerId = options.callerId || "";
      if (!(callerId in options.data)) {
        options.data[callerId] = {};
      }
      options.data[callerId][id] -= amount;
    } catch (e) {
      ConsoleLogger.warn(`${id} is not a number`, e);
    }
  },
};

export const inc = {
  params: [
    { types: [bbscriptParamTypes.Identifier] },
    { types: [bbscriptParamTypes.Int], default: 1 },
  ],
  func: (options, id, amount = 1) => {
    try {
      const callerId = options.callerId || "";
      if (!(callerId in options.data)) {
        options.data[callerId] = {};
      }
      options.data[callerId][id] += amount;
    } catch (e) {
      ConsoleLogger.warn(`${id} is not a number`, e);
    }
  },
};

/**
 * Map between bbscript function name and logic.
 * keys must be all lowercase. Parser will apply lowercase to user input,
 * so is case-insensitive.
 * @type {bbscriptFuncMap}
 */
export const bbscriptFunctions = {
  print,
  eq,
  ge,
  geq,
  le,
  leq,
  if: conditional,
  stop,
  set,
  dec,
  inc,
  addclass: addClass,
  removeclass: removeClass,
  fadein: fadeIn,
  fadeout: fadeOut,
  fadetoggle: fadeToggle,
  hide,
  show,
  gettext: getText,
  settext: setText,
  slidedown: slideDown,
  slideup: slideUp,
  slidetoggle: slideToggle,
  random,
  add,
};
