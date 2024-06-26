import { MD_NEWLINE_INJECT, MD_NEWLINE_INJECT_COMMENT, MD_NEWLINE_PRE_INJECT } from "./common";

/**
 * Post Processing designed to fix issues with Markdown and BBCode that the parser can't fix.
 *
 * Separate from markdown-it post processing as it'll be able to manipulate the full string.
 * @param {string} raw string from processing through both BBCode and Markdown
 * @returns post processed string
 */
function removeNewlineInjects(raw) {
  const processed = raw
    .replaceAll(MD_NEWLINE_INJECT, "")
    .replaceAll(MD_NEWLINE_PRE_INJECT, "")
    .replaceAll(MD_NEWLINE_INJECT_COMMENT, ""); // Remove all instances of the injected newline
  return processed;
}

/**
 * Injects hoisted code blocks back into the raw string
 * @param {string} raw input to inject hoisted code blocks into
 * @param {any} data contains hoist map
 * @returns string with hoisted code blocks injected
 */
function renderHoistedCodeBlocks(raw, data) {
  const hoistMap = data.hoistMap;
  for (const [uuid, content] of Object.entries(hoistMap)) {
    raw = raw.replaceAll(uuid, content);
  }
  return raw;
}

/**
 * Performs post processing on the raw string to address any necessary functionality that BBob/MD can't handle with a plugin (i.e. hoisting).
 * @param {string} raw processed input from after bbob and md
 * @param {any} data from bbob data
 * @returns final processed string
 */
export function postprocess(raw, data) {
  let final = raw;
  const postprocessors = [removeNewlineInjects, renderHoistedCodeBlocks];
  for (const postprocessor of postprocessors) {
    final = postprocessor(final, data);
  }
  return final;
}
