/** @typedef {import('./utils').BBScriptFunc} BBScriptFunc */
/** @typedef {import('./utils').BBScriptFuncMap} BBScriptFuncMap */
/** @typedef {import('./utils').BBScriptReturnTypes} BBScriptReturnTypes */
/** @typedef {import('./AST').ASTNode} ASTNode */
/** @typedef {import('./processor').BBScriptOptions} BBScriptOptions */
import $ from "jquery";
import { ASTError } from "./ASTError";
import { ASTIdentifier } from "./AST";
import {
  CLASS_NAME_RE,
  STOP_MESSAGE,
  isStopError,
  readVariable,
  scopedClassName,
  scopedElements,
} from "../scope";
import { ConsoleLogger } from "../logger";

const MAX_RANGE_LENGTH = 10000;

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
  if (!Array.isArray(arrVal) && typeof arrVal !== "string") {
    throw new ASTError(arr, "Does not resolve to an array or string");
  }
  return needleVal !== undefined && arrVal.includes(needleVal);
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
  if (!Array.isArray(arrVal) && typeof arrVal !== "string") {
    throw new ASTError(arr, "Does not resolve to an array or string");
  }
  return needleVal === undefined ? -1 : arrVal.indexOf(needleVal);
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} arr
 * @param {ASTNode} i
 * @param {ASTNode | undefined} [val]
 * @returns {BBScriptReturnTypes}
 */
const index = (options, arr, i, val = undefined) => {
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
const join = (options, arr, sep = undefined) => {
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
 * @param {ASTNode | undefined} [end] slices to the end when omitted
 * @returns {string | BBScriptReturnTypes[]}
 */
const slice = (options, arr, start, end = undefined) => {
  const val = arr.resolveValue(options);
  if (!Array.isArray(val) && typeof val !== "string") {
    throw new ASTError(arr, "Does not resolve to an array or string");
  }
  const startVal = +start.resolveValue(options);
  const endVal = end === undefined ? undefined : +end.resolveValue(options);
  return val.slice(startVal, endVal);
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} arr
 * @param {ASTNode} func
 * @param {ASTNode | undefined} [token]
 * @returns {void}
 */
const each = (options, arr, func, token = undefined) => {
  const arrVal = arr.resolveValue(options);
  if (!Array.isArray(arrVal)) {
    throw new ASTError(arr, "Does not resolve to an array");
  }
  const tokenVar =
    token !== undefined ? String(token.resolveValue(options)) : "_";
  const scope = options.data;
  const shadowed = Object.hasOwn(scope, tokenVar);
  const previous = scope[tokenVar];
  try {
    for (const e of arrVal) {
      scope[tokenVar] = e;
      func.resolveValue(options);
    }
  } finally {
    if (shadowed) {
      scope[tokenVar] = previous;
    } else {
      delete scope[tokenVar];
    }
  }
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode | undefined} [target] class name to look up in the post; the script's own target when omitted
 */
const getJQueryEl = (options, target) => {
  if (target === undefined) {
    return $(options.target);
  }
  const className = String(target.resolveValue(options)).trim();
  if (!CLASS_NAME_RE.test(className)) {
    throw new ASTError(target, "Invalid class name");
  }
  return $(scopedElements(options, className));
};
/**
 * Resolves a class name, a space separated list or an array of them into the
 * caller's scoped class names
 * @param {BBScriptOptions} options
 * @param {ASTNode} node
 * @returns {string[]}
 */
const scopedClassNames = (options, node) => {
  const value = node.resolveValue(options);
  const names = (
    Array.isArray(value) ? value.map(String) : String(value).split(/\s+/)
  ).filter(Boolean);
  if (!names.every((name) => CLASS_NAME_RE.test(name))) {
    throw new ASTError(node, "Invalid class name");
  }
  return names.map((name) => scopedClassName(name, options.callerId));
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} newClass
 * @param {ASTNode | undefined} [target]
 * @returns {void}
 */
const addClass = (options, newClass, target = undefined) => {
  getJQueryEl(options, target).addClass(scopedClassNames(options, newClass));
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} oldClass
 * @param {ASTNode | undefined} [target]
 * @returns {void}
 */
const removeClass = (options, oldClass, target = undefined) => {
  getJQueryEl(options, target).removeClass(scopedClassNames(options, oldClass));
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} className
 * @param {ASTNode | undefined} [target]
 * @returns {void}
 */
const toggleClass = (options, className, target = undefined) => {
  getJQueryEl(options, target).toggleClass(
    scopedClassNames(options, className)
  );
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} className
 * @param {ASTNode | undefined} [target]
 * @returns {boolean} whether any target has every given class
 */
const hasClass = (options, className, target = undefined) => {
  const names = scopedClassNames(options, className);
  return getJQueryEl(options, target)
    .toArray()
    .some((el) => names.every((name) => el.classList.contains(name)));
};
/**
 * Scroll the target element into view
 * @param {BBScriptOptions} options
 * @param {ASTNode | undefined} target
 */
const scrollIntoView = (options, target = undefined) => {
  getJQueryEl(options, target)[0]?.scrollIntoView();
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode | undefined} [duration]
 * @param {ASTNode | undefined} [target]
 * @returns {void}
 */
const fadeIn = (options, duration = undefined, target = undefined) => {
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
const fadeOut = (options, duration = undefined, target = undefined) => {
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
const fadeToggle = (options, duration = undefined, target = undefined) => {
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
const hide = (options, target = undefined) => {
  const targetEl = getJQueryEl(options, target);
  targetEl.hide();
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode | undefined} [target]
 * @returns {void}
 */
const show = (options, target = undefined) => {
  const targetEl = getJQueryEl(options, target);
  targetEl.show();
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode | undefined} [target]
 * @returns {any}
 */
const getText = (options, target = undefined) => {
  const targetEl = getJQueryEl(options, target);
  return targetEl.text();
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} text
 * @param {ASTNode | undefined} [target]
 * @returns {void}
 */
const setText = (options, text, target = undefined) => {
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
const slideDown = (options, duration = undefined, target = undefined) => {
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
const slideUp = (options, duration = undefined, target = undefined) => {
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
const slideToggle = (options, duration = undefined, target = undefined) => {
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
const addDiv = (options, classes, target = undefined) => {
  const div = $("<div>").addClass(scopedClassNames(options, classes));
  getJQueryEl(options, target).append(div);
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} classes
 * @param {ASTNode | undefined} [target]
 * @returns {void}
 */
const removeDiv = (options, classes, target = undefined) => {
  const selector = "div." + scopedClassNames(options, classes).join(".");
  // a matching target removes itself, as it always has
  getJQueryEl(options, target).find(selector).addBack(selector).remove();
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} value
 * @returns {boolean}
 */
const not = (options, value) => {
  return !value.resolveValue(options);
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
const conditional = (options, test, caseTrue, caseFalse = undefined) => {
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
  throw new Error(STOP_MESSAGE);
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
  const handle = setTimeout(
    () => {
      options.timers.delete(handle);
      runDeferred(options, func);
    },
    Math.round(secsVal * 1000)
  );
  options.timers.add(handle);
  return handle;
};
/**
 * Runs a timer's function, where a stop ends that run only. Some views drop a
 * post without tearing it down, so a timer whose post has left the page does nothing.
 * @param {BBScriptOptions} options
 * @param {ASTNode} func
 * @returns {boolean} false once the post has left the page
 */
const runDeferred = (options, func) => {
  if (options.root && !options.root.isConnected) {
    return false;
  }
  try {
    func.resolveValue(options);
  } catch (error) {
    if (!isStopError(error)) {
      throw error;
    }
  }
  return true;
};
/**
 * Only the post's own timers can be cleared.
 * @param {BBScriptOptions} options
 * @param {ASTNode} id
 * @returns {void}
 */
const clearTimerFunc = (options, id) => {
  const handle = +id.resolveValue(options);
  if (options.timers.delete(handle)) {
    clearTimeout(handle);
  }
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
  const handle = setInterval(
    () => {
      if (!runDeferred(options, func)) {
        clearInterval(handle);
        options.timers.delete(handle);
      }
    },
    Math.round(secsVal * 1000)
  );
  options.timers.add(handle);
  return handle;
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
const split = (options, str, sep = undefined) => {
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
  return strVal.replaceAll(
    needle.resolveValue(options),
    replacement.resolveValue(options)
  );
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
  if (!(variable instanceof ASTIdentifier)) {
    throw new ASTError(variable, "Cannot assign to non identifier");
  }
  options.data[variable.name] = value;
};
/**
 * JS loosy add for strings or nums
 * @param {BBScriptOptions} options
 * @param {ASTNode} first
 * @param {...ASTNode} [rest]
 * @returns {string | number}
 */
const add = (options, first, ...rest) => {
  const addElems = [first, ...rest].map((p) => p.resolveValue(options));
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
 * @param {ASTNode} first
 * @param {...ASTNode} [rest]
 * @returns {number}
 */
const subtract = (options, first, ...rest) => {
  const subElems = resolveToNums(options, [first, ...rest]);
  return subElems.reduce((a, b) => a - b);
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} first
 * @param {...ASTNode} [rest]
 * @returns {number}
 */
const multiply = (options, first, ...rest) => {
  const elems = resolveToNums(options, [first, ...rest]);
  return elems.reduce((a, b) => a * b);
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} first
 * @param {...ASTNode} [rest]
 * @returns {number}
 */
const divide = (options, first, ...rest) => {
  const elems = resolveToNums(options, [first, ...rest]);
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
 * Converts text such as `getText` output into a number
 * @param {BBScriptOptions} options
 * @param {ASTNode} value
 * @returns {number} `NaN` when the text isn't a number
 */
const number = (options, value) => {
  const resolved = value.resolveValue(options);
  if (typeof resolved === "string" && resolved.trim() === "") {
    return NaN;
  }
  return Number(resolved);
};
/**
 * `(range end)`, `(range start end)` or `(range start end step)`; `end` is excluded
 * @param {BBScriptOptions} options
 * @param {ASTNode} first
 * @param {ASTNode | undefined} [second]
 * @param {ASTNode | undefined} [stepNode]
 * @returns {number[]}
 */
const range = (options, first, second = undefined, stepNode = undefined) => {
  const nodes = [first, second, stepNode].filter((node) => node !== undefined);
  const nums = resolveToNums(options, nodes);
  const [start, end, step] =
    nums.length === 1 ? [0, nums[0], 1] : [nums[0], nums[1], nums[2] ?? 1];
  if (!step) {
    throw new ASTError(stepNode, "Step cannot be zero");
  }
  const length = Math.max(0, Math.ceil((end - start) / step));
  if (length > MAX_RANGE_LENGTH) {
    throw new ASTError(first, `Range is longer than ${MAX_RANGE_LENGTH}`);
  }
  return Array.from({ length }, (_, i) => start + i * step);
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} variable
 * @param {number} delta
 * @returns {void}
 */
const stepVariable = (options, variable, delta) => {
  if (!(variable instanceof ASTIdentifier)) {
    throw new ASTError(variable, "Not an identifier variable");
  }
  const current = readVariable(options, variable.name);
  if (current === undefined || current === null) {
    throw new ASTError(variable, "Identifier not set yet");
  }
  if (typeof current !== "number") {
    throw new ASTError(variable, "Not a number");
  }
  options.data[variable.name] = current + delta;
};
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} variable
 * @returns {void}
 */
const decrement = (options, variable) => stepVariable(options, variable, -1);
/**
 * @param {BBScriptOptions} options
 * @param {ASTNode} variable
 * @returns {void}
 */
const increment = (options, variable) => stepVariable(options, variable, 1);
/**
 * No prototype, so a script can't call names such as `constructor`. A
 * function's required arguments are its parameters without a default, after
 * `options`; optional ones default to `undefined`.
 */
export const bbscriptFunctions = Object.assign(Object.create(null), {
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
  toggleClass,
  hasClass,
  scrollIntoView,
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
  not,
  "!": not,
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
  clearTimeout: clearTimerFunc,
  setInterval: intervalFunc,
  clearInterval: clearTimerFunc,
  print,
  split,
  lower,
  upper,
  trim,
  replace,
  number,
  range,
  "=": assign,
  "+": add,
  "-": subtract,
  "*": multiply,
  "/": divide,
  "%": mod,
  "**": exp,
  "--": decrement,
  "++": increment,
});
