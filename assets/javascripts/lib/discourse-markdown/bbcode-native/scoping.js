// Shared by cooking, the bbscript bundle and its initializer, so all three
// agree on what a scoped name is. Keep this file free of imports.

/** Class names become selectors, so they must not be able to end one. */
export const CLASS_NAME_RE = /^-?[A-Za-z_][\w-]*$/;

/** The only script ids cooking generates (see guidFor). */
export const CALLER_ID_RE = /^(post-[a-z0-9]+|preview)$/;

/**
 * @param {string} name
 * @param {string} callerId
 * @returns {string} the class name as it appears in the post
 */
export function scopedClassName(name, callerId) {
  return `${name}__${callerId}`;
}
