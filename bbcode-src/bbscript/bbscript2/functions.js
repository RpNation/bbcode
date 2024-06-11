/** @typedef {import('./utils').BBScriptFunc} BBScriptFunc */
/** @typedef {import('./utils').BBScriptFuncMap} BBScriptFuncMap */
/** @typedef {import('./utils').BBScriptReturnTypes} BBScriptReturnTypes */
/** @typedef {import('./AST').ASTNode} ASTNode */
/** @typedef {import('./processor').BBScriptOptions} BBScriptOptions */
import { ASTError } from "./ASTError";
import { ASTIdentifier } from "./AST";
import { ConsoleLogger } from "../logger";

/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} arr
 * @returns {number}
 */
const count = (options, arr) => {
  const arrVal = arr.resolveValue(options);
  if (Array.isArray(arrVal) || typeof arrVal === "string") {
    return arrVal.length;
  } else {
    throw new ASTError(arr, "Does not resolve to an array or string");
  }
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} arr
 * @param {ASTNode} needle
 * @returns {boolean}
 */
const contain = (options, arr, needle) => {
  const arrVal = arr.resolveValue(options);
  const needleVal = needle.resolveValue(options);
  if (Array.isArray(arrVal) && needleVal !== undefined) {
    return arrVal.includes(needleVal);
  }
  if (typeof arrVal === "string" && needleVal !== undefined) {
    return arrVal.includes(needleVal);
  }
  if (!Array.isArray(arrVal) || typeof arrVal !== "string") {
    throw new ASTError(arr, "Does not resolve to an array or string");
  }
  return false;
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} arr
 * @param {ASTNode} needle
 * @returns {number}
 */
const find = (options, arr, needle) => {
  const arrVal = arr.resolveValue(options);
  const needleVal = needle.resolveValue(options);
  if (Array.isArray(arrVal) && needleVal !== undefined) {
    return arrVal.indexOf(needleVal);
  }
  if (!Array.isArray(arrVal)) {
    throw new ASTError(arr, "Does not resolve to an array");
  }
  return -1;
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} arr
 * @param {ASTNode} i
 * @param {ASTNode | undefined} [val]
 * @returns {BBScriptReturnTypes}
 */
const index = (options, arr, i, val) => {
  const arrVal = arr.resolveValue(options);
  const idx = +i.resolveValue(options);
  if (!Array.isArray(arrVal)) {
    throw new ASTError(arr, "Does not resolve to an array");
  }
  if (val === undefined) {
    return arrVal[idx];
  }
  const newVal = val.resolveValue(options);
  arrVal[idx] = newVal;
  return arrVal[idx];
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} arr
 * @param {ASTNode} val
 * @returns {number}
 */
const append = (options, arr, val) => {
  const arrVal = arr.resolveValue(options);
  const newVal = val.resolveValue(options);
  if (!Array.isArray(arrVal)) {
    throw new ASTError(arr, "Does not resolve to an array");
  }
  // js array is pass by reference, so options.data will be updated if applicable
  return arrVal.push(newVal);
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} arr
 * @param {ASTNode} i
 * @param {ASTNode} val
 * @returns {void}
 */
const insert = (options, arr, i, val) => {
  const arrVal = arr.resolveValue(options);
  if (!Array.isArray(arrVal)) {
    throw new ASTError(arr, "Does not resolve to an array");
  }
  const idx = +i.resolveValue(options);
  if (typeof idx !== "number") {
    throw new ASTError(i, "Does not resolve to a number");
  }
  const newVal = val.resolveValue(options);
  arrVal.splice(Math.floor(idx), 0, newVal);
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} arr
 * @returns {BBScriptReturnTypes | undefined}
 */
const pop = (options, arr) => {
  const arrVal = arr.resolveValue(options);
  if (!Array.isArray(arrVal)) {
    throw new ASTError(arr, "Does not resolve to an array");
  }
  return arrVal.pop();
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} arr
 * @param {ASTNode} i
 * @returns {BBScriptReturnTypes}
 */
const remove = (options, arr, i) => {
  const arrVal = arr.resolveValue(options);
  if (!Array.isArray(arrVal)) {
    throw new ASTError(arr, "Does not resolve to an array");
  }
  const idx = +i.resolveValue(options);
  return arrVal.splice(idx, 1)[0];
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} arr
 * @returns {BBScriptReturnTypes[]}
 */
const reverse = (options, arr) => {
  const arrVal = arr.resolveValue(options);
  if (!Array.isArray(arrVal)) {
    throw new ASTError(arr, "Does not resolve to an array");
  }
  return arrVal.reverse();
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} arr
 * @param {ASTNode | undefined} [sep]
 * @returns {string}
 */
const join = (options, arr, sep) => {
  const arrVal = arr.resolveValue(options);
  let sepVal = "";
  if (!Array.isArray(arrVal)) {
    throw new ASTError(arr, "Does not resolve to an array");
  }
  if (sep !== undefined) {
    sepVal = String(sep.resolveValue(options));
  }
  return arrVal.join(sepVal);
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} arr
 * @returns {BBScriptReturnTypes[]}
 */
const shuffle = (options, arr) => {
  const arrVal = arr.resolveValue(options);
  if (!Array.isArray(arrVal)) {
    throw new ASTError(arr, "Does not resolve to an array");
  }
  for (let i = arrVal.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arrVal[i], arrVal[j]] = [arrVal[j], arrVal[i]];
  }
  return arrVal;
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} arr
 * @param {ASTNode} start
 * @param {ASTNode} end
 * @returns {string | BBScriptReturnTypes[]}
 */
const slice = (options, arr, start, end) => {
  const val = arr.resolveValue(options);
  if (!Array.isArray(val) && typeof val !== "string") {
    throw new ASTError(arr, "Does not resolve to an array or string");
  }
  const startVal = +start.resolveValue(options);
  const endVal = +end.resolveValue(options);
  return val.slice(startVal, endVal);
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} arr
 * @param {ASTNode} func
 * @param {ASTNode | undefined} [token]
 * @returns {void}
 */
const each = (options, arr, func, token) => {
  const arrVal = arr.resolveValue(options);
  if (!Array.isArray(arrVal)) {
    throw new ASTError(arr, "Does not resolve to an array");
  }
  const tokenVar = token !== undefined ? String(token.resolveValue(options)) : "_";
  // eslint-disable-next-line eqeqeq
  if (options.data[options.callerId] == undefined) {
    options.data[options.callerId] = {};
  }
  for (const e of arrVal) {
    options.data[options.callerId][tokenVar] = e;
    func.resolveValue(options);
  }
  delete options.data[options.callerId][tokenVar];
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode | undefined} [target]
 * @returns {any}
 */
const getJQueryEl = (options, target) => {
  if (target !== undefined) {
    const search = "." + String(target.resolveValue(options)).trim() + "__" + options.callerId;
    return $(search);
  } else {
    return $(options.target);
  }
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} newClass
 * @param {ASTNode | undefined} [target]
 * @returns {void}
 */
const addClass = (options, newClass, target) => {
  let className = String(newClass.resolveValue(options));
  className &&= className + "__" + options.callerId;
  const targetEl = getJQueryEl(options, target);
  targetEl.addClass(className);
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} oldClass
 * @param {ASTNode | undefined} [target]
 * @returns {void}
 */
const removeClass = (options, oldClass, target) => {
  let className = String(oldClass.resolveValue(options));
  className &&= className + "__" + options.callerId;
  const targetEl = getJQueryEl(options, target);
  targetEl.removeClass(className);
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode | undefined} [duration]
 * @param {ASTNode | undefined} [target]
 * @returns {void}
 */
const fadeIn = (options, duration, target) => {
  const targetEl = getJQueryEl(options, target);
  if (duration !== undefined) {
    const time = +duration.resolveValue(options);
    targetEl.fadeIn(time || 1000);
  } else {
    targetEl.fadeIn(1000);
  }
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode | undefined} [duration]
 * @param {ASTNode | undefined} [target]
 * @returns {void}
 */
const fadeOut = (options, duration, target) => {
  const targetEl = getJQueryEl(options, target);
  if (duration !== undefined) {
    const time = +duration.resolveValue(options);
    targetEl.fadeOut(time || 1000);
  } else {
    targetEl.fadeOut(1000);
  }
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode | undefined} [duration]
 * @param {ASTNode | undefined} [target]
 * @returns {void}
 */
const fadeToggle = (options, duration, target) => {
  const targetEl = getJQueryEl(options, target);
  if (duration !== undefined) {
    const time = +duration.resolveValue(options);
    targetEl.fadeToggle(time || 1000);
  } else {
    targetEl.fadeToggle(1000);
  }
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode | undefined} [target]
 * @returns {void}
 */
const hide = (options, target) => {
  const targetEl = getJQueryEl(options, target);
  targetEl.hide();
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode | undefined} [target]
 * @returns {void}
 */
const show = (options, target) => {
  const targetEl = getJQueryEl(options, target);
  targetEl.show();
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode | undefined} [target]
 * @returns {any}
 */
const getText = (options, target) => {
  const targetEl = getJQueryEl(options, target);
  return targetEl.text();
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} text
 * @param {ASTNode | undefined} [target]
 * @returns {void}
 */
const setText = (options, text, target) => {
  const targetEl = getJQueryEl(options, target);
  const textVal = text.resolveValue(options);
  targetEl.text(textVal);
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode | undefined} [duration]
 * @param {ASTNode | undefined} [target]
 * @returns {void}
 */
const slideDown = (options, duration, target) => {
  const targetEl = getJQueryEl(options, target);
  if (duration !== undefined) {
    const time = +duration.resolveValue(options);
    targetEl.slideDown(time || 1000);
  } else {
    targetEl.slideDown(1000);
  }
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode | undefined} [duration]
 * @param {ASTNode | undefined} [target]
 * @returns {void}
 */
const slideUp = (options, duration, target) => {
  const targetEl = getJQueryEl(options, target);
  if (duration !== undefined) {
    const time = +duration.resolveValue(options);
    targetEl.slideUp(time || 1000);
  } else {
    targetEl.slideUp(1000);
  }
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode | undefined} [duration]
 * @param {ASTNode | undefined} [target]
 * @returns {void}
 */
const slideToggle = (options, duration, target) => {
  const targetEl = getJQueryEl(options, target);
  if (duration !== undefined) {
    const time = +duration.resolveValue(options);
    targetEl.slideToggle(time || 1000);
  } else {
    targetEl.slideToggle(1000);
  }
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} classes
 * @param {ASTNode | undefined} [target]
 * @returns {void}
 */
const addDiv = (options, classes, target) => {
  const targetEl = getJQueryEl(options, target);
  let classList = "";
  const classVal = classes.resolveValue(options);
  if (Array.isArray(classVal)) {
    classList = classVal.map((c) => c + "__" + options.callerId).join(" ");
  } else {
    classList = classVal + "__" + options.callerId;
  }
  targetEl.append(`<div class="${classList}"></div>`);
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} classes
 * @param {ASTNode | undefined} [target]
 * @returns {void}
 */
const removeDiv = (options, classes, target) => {
  const targetEl = getJQueryEl(options, target);
  let classList = "";
  const classVal = classes.resolveValue(options);
  if (Array.isArray(classVal)) {
    classList = "." + classVal.map((c) => c + "__" + options.callerId).join(".");
  } else {
    classList = "." + classVal + "__" + options.callerId;
  }
  targetEl.remove(classList);
};
/**
 * @param {BBScriptOptions} options
 * @param {...ASTNode} [params]
 * @returns {boolean}
 */
const and = (options, ...params) => {
  return params.every((a) => !!a.resolveValue(options)); // allows for quick fallout if falsy
};
/**
 * @param {BBScriptOptions} options
 * @param {...ASTNode} [params]
 * @returns {boolean}
 */
const or = (options, ...params) => {
  return params.some((a) => !!a.resolveValue(options)); // allows for quick fallout if truthy
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} lhs
 * @param {ASTNode} rhs
 * @returns {boolean}
 */
const equal = (options, lhs, rhs) => {
  // eslint-disable-next-line eqeqeq
  return lhs.resolveValue(options) == rhs.resolveValue(options);
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} lhs
 * @param {ASTNode} rhs
 * @returns {boolean}
 */
const notEqual = (options, lhs, rhs) => {
  // eslint-disable-next-line eqeqeq
  return lhs.resolveValue(options) != rhs.resolveValue(options);
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} lhs
 * @param {ASTNode} rhs
 * @returns {boolean}
 */
const greaterThan = (options, lhs, rhs) => {
  return lhs.resolveValue(options) > rhs.resolveValue(options);
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} lhs
 * @param {ASTNode} rhs
 * @returns {boolean}
 */
const greaterOrEqual = (options, lhs, rhs) => {
  return lhs.resolveValue(options) >= rhs.resolveValue(options);
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} lhs
 * @param {ASTNode} rhs
 * @returns {boolean}
 */
const lessThan = (options, lhs, rhs) => {
  return lhs.resolveValue(options) < rhs.resolveValue(options);
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} lhs
 * @param {ASTNode} rhs
 * @returns {boolean}
 */
const lessOrEqual = (options, lhs, rhs) => {
  return lhs.resolveValue(options) <= rhs.resolveValue(options);
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} test
 * @param {ASTNode} caseTrue
 * @param {ASTNode | undefined} [caseFalse]
 * @returns {BBScriptReturnTypes}
 */
const conditional = (options, test, caseTrue, caseFalse) => {
  const result = test.resolveValue(options);
  if (result) {
    return caseTrue.resolveValue(options);
  } else if (caseFalse !== undefined) {
    return caseFalse.resolveValue(options);
  }
};
/**
 * @param {BBScriptOptions} options
 * @param {...ASTNode} [exec]
 * @returns {BBScriptReturnTypes}
 */
const group = (options, ...exec) => {
  const values = exec.map((a) => a.resolveValue(options));
  return values[values.length - 1];
};
/**
 * @returns {never}
 */
const stop = () => {
  throw new Error("BBScript Stop Command"); // throw an error for easy exit and less try-catching
};
/**
 * @returns {number}
 */
const random = () => {
  return Math.random();
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} min
 * @param {ASTNode} max
 * @returns {number}
 */
const randomInt = (options, min, max) => {
  const minVal = +min.resolveValue(options);
  const maxVal = +max.resolveValue(options);
  return Math.floor(Math.random() * (maxVal - minVal + 1) + minVal);
};
/**
 * @returns {number}
 */
const time = () => {
  return new Date().getTime();
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} secs
 * @param {ASTNode} func
 * @returns {number}
 */
const timeoutFunc = (options, secs, func) => {
  const secsVal = secs.resolveValue(options);
  if (typeof secsVal !== "number") {
    throw new ASTError(secs, "Does not resolve to a number");
  }
  return setTimeout(
    () => {
      func.resolveValue(options);
    },
    Math.round(secsVal * 1000),
  );
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} id
 * @returns {void}
 */
const clearTimeoutFunc = (options, id) => {
  const handle = +id.resolveValue(options);
  clearTimeout(handle);
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} secs
 * @param {ASTNode} func
 * @returns {number}
 */
const intervalFunc = (options, secs, func) => {
  const secsVal = secs.resolveValue(options);
  if (typeof secsVal !== "number") {
    throw new ASTError(secs, "Does not resolve to a number");
  }
  return setInterval(() => func.resolveValue(options), Math.round(secsVal * 1000));
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} id
 * @returns {void}
 */
const clearIntervalFunc = (options, id) => {
  const handle = +id.resolveValue(options);
  clearInterval(handle);
};
/**
 * @param {BBScriptOptions} options
 * @param {...ASTNode} [nodes]
 * @returns {void}
 */
const print = (options, ...nodes) => {
  const values = nodes.map((n) => n.resolveValue(options));
  ConsoleLogger.log(...values);
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} str
 * @param {ASTNode | undefined} [sep]
 * @returns {string[]}
 */
const split = (options, str, sep) => {
  const strVal = String(str.resolveValue(options));
  let sepVal = "";
  if (sep !== undefined) {
    const res = sep.resolveValue(options);
    if (typeof res === "string") {
      sepVal = res;
    }
  }
  return strVal.split(sepVal);
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} str
 * @returns {string}
 */
const lower = (options, str) => {
  const strVal = String(str.resolveValue(options));
  return strVal.toLowerCase();
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} str
 * @returns {string}
 */
const upper = (options, str) => {
  const strVal = String(str.resolveValue(options));
  return strVal.toUpperCase();
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} str
 * @returns {string}
 */
const trim = (options, str) => {
  const strVal = String(str.resolveValue(options));
  return strVal.trim();
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} str
 * @param {ASTNode} needle
 * @param {ASTNode} replacement
 * @returns {string}
 */
const replace = (options, str, needle, replacement) => {
  const strVal = String(str.resolveValue(options));
  return strVal.replaceAll(needle.resolveValue(options), replacement.resolveValue(options));
};
/**
 * create/assign to data variable
 * @param {BBScriptOptions} options
 * @param {ASTNode} variable
 * @param {ASTNode} input
 * @returns {void}
 */
const assign = (options, variable, input) => {
  const value = input.resolveValue(options);
  let varName;
  if (variable instanceof ASTIdentifier) {
    varName = variable.name;
    // eslint-disable-next-line eqeqeq
    if (options.data[options.callerId] == undefined) {
      options.data[options.callerId] = {};
    }
    options.data[options.callerId][varName] = value;
    return;
  }
  throw new ASTError(variable, "Cannot assign to non identifier");
};
/**
 * JS loosy add for strings or nums
 * @param {BBScriptOptions} options
 * @param {...ASTNode} [params]
 * @returns {string | number}
 */
const add = (options, ...params) => {
  const addElems = params.map((p) => p.resolveValue(options));
  return addElems.reduce((a, b) => a + b);
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode[]} param
 * @returns {number[]}
 */
const resolveToNums = (options, param) => {
  return param.map((p) => {
    const v = p.resolveValue(options);
    if (typeof v !== "number") {
      throw new ASTError(p, "Does not resolve to a number");
    }
    return v;
  });
};
/**
 * @param {BBScriptOptions} options
 * @param {...ASTNode} [params]
 * @returns {number}
 */
const subtract = (options, ...params) => {
  const subElems = resolveToNums(options, params);
  return subElems.reduce((a, b) => a - b);
};
/**
 * @param {BBScriptOptions} options
 * @param {...ASTNode} [params]
 * @returns {number}
 */
const multiply = (options, ...params) => {
  const elems = resolveToNums(options, params);
  return elems.reduce((a, b) => a * b);
};
/**
 * @param {BBScriptOptions} options
 * @param {...ASTNode} [params]
 * @returns {number}
 */
const divide = (options, ...params) => {
  const elems = resolveToNums(options, params);
  return elems.reduce((a, b) => a / b);
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} value
 * @param {ASTNode} base
 * @returns {number}
 */
const mod = (options, value, base) => {
  const [valueNum, baseNum] = resolveToNums(options, [value, base]);
  return valueNum % baseNum;
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} base
 * @param {ASTNode} expo
 * @returns {number}
 */
const exp = (options, base, expo) => {
  const [expoNum, baseNum] = resolveToNums(options, [expo, base]);
  return baseNum ** expoNum;
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} variable
 * @returns {void}
 */
const decrement = (options, variable) => {
  if (variable instanceof ASTIdentifier) {
    const varName = variable.name;
    if (
      // eslint-disable-next-line eqeqeq
      options.data[options.callerId] == undefined ||
      // eslint-disable-next-line eqeqeq
      options.data[options.callerId][varName] == undefined
    ) {
      throw new ASTError(variable, "Identifier not set yet");
    }
    if (typeof options.data[options.callerId][varName] !== "number") {
      throw new ASTError(variable, "Not a number");
    }
    options.data[options.callerId][varName] -= 1;
    return;
  }
  throw new ASTError(variable, "Not an identifier variable");
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} variable
 * @returns {void}
 */
const increment = (options, variable) => {
  if (variable instanceof ASTIdentifier) {
    const varName = variable.name;
    if (
      // eslint-disable-next-line eqeqeq
      options.data[options.callerId] == undefined ||
      // eslint-disable-next-line eqeqeq
      options.data[options.callerId][varName] == undefined
    ) {
      throw new ASTError(variable, "Identifier not set yet");
    }
    if (typeof options.data[options.callerId][varName] !== "number") {
      throw new ASTError(variable, "Not a number");
    }
    options.data[options.callerId][varName] += 1;
    return;
  }
  throw new ASTError(variable, "Not an identifier variable");
};
export const bbscriptFunctions = {
  count,
  contain,
  find,
  index,
  append,
  insert,
  pop,
  remove,
  reverse,
  join,
  shuffle,
  slice,
  each,
  addClass,
  removeClass,
  fadeIn,
  fadeOut,
  fadeToggle,
  hide,
  show,
  getText,
  setText,
  slideDown,
  slideUp,
  slideToggle,
  addDiv,
  removeDiv,
  and,
  or,
  "==": equal,
  "!=": notEqual,
  ">": greaterThan,
  ">=": greaterOrEqual,
  "<": lessThan,
  "<=": lessOrEqual,
  if: conditional,
  group,
  stop,
  random,
  randomInt,
  time,
  setTimeout: timeoutFunc,
  clearTimeout: clearTimeoutFunc,
  setInterval: intervalFunc,
  clearInterval: clearIntervalFunc,
  print,
  split,
  lower,
  upper,
  trim,
  replace,
  "=": assign,
  "+": add,
  "-": subtract,
  "*": multiply,
  "/": divide,
  "%": mod,
  "**": exp,
  "--": decrement,
  "++": increment,
};
