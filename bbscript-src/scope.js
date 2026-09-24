/** @typedef {import('./bbscript2/processor').BBScriptOptions} BBScriptOptions */
import {
  CALLER_ID_RE,
  CLASS_NAME_RE,
  scopedClassName,
} from "../assets/javascripts/lib/discourse-markdown/bbcode-native/scoping.js";
import { ConsoleLogger } from "./logger";

export { CLASS_NAME_RE, scopedClassName };
export const STOP_MESSAGE = "BBScript Stop Command";

/**
 * @param {unknown} error
 * @returns {boolean}
 */
export function isStopError(error) {
  return error instanceof Error && error.message === STOP_MESSAGE;
}

/**
 * A store for one rendered post's variables. It has no prototype, so script
 * names such as `__proto__` stay ordinary keys.
 * @returns {Object<string, any>}
 */
export function createStore() {
  return Object.create(null);
}

/**
 * The options a processor runs a post's scripts with.
 * @param {BBScriptOptions} defaults the processor's own options
 * @param {Partial<BBScriptOptions>} options
 * @param {string} callerId
 * @param {string} callerClass
 * @returns {BBScriptOptions | null} `null` for an id cooking can't have produced
 */
export function runOptions(defaults, options, callerId, callerClass) {
  if (!CALLER_ID_RE.test(callerId || "")) {
    ConsoleLogger.warn("BBScript: invalid caller id", callerId);
    return null;
  }
  return {
    ...defaults,
    ...options,
    data: options.data ?? createStore(),
    timers: options.timers ?? new Set(),
    callerId,
    callerClass,
  };
}

/**
 * @param {BBScriptOptions} options
 * @param {string} name
 * @returns {any} the variable's value, or `undefined` when unset
 */
export function readVariable(options, name) {
  return Object.hasOwn(options.data, name) ? options.data[name] : undefined;
}

/**
 * Elements with the caller's scoped class, looked up inside the post only.
 * @param {BBScriptOptions} options
 * @param {string} className
 * @returns {Element[]}
 */
export function scopedElements(options, className) {
  if (!CLASS_NAME_RE.test(className) || !options.root) {
    return [];
  }
  const selector = `.${scopedClassName(className, options.callerId)}`;
  return [...options.root.querySelectorAll(selector)];
}
