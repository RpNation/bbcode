import { MD_NEWLINE_INJECT } from "./common";

/**
 * Post Processing designed to fix issues with Markdown and BBCode that the parser can't fix.
 *
 * Separate from markdown-it post processing as it'll be able to manipulate the full string.
 * @param {string} raw string from processing through both BBCode and Markdown
 * @returns post processed string
 */
export function postMdProcess(raw) {
  const processed = raw.replaceAll(MD_NEWLINE_INJECT, ""); // Remove all instances of the injected newline

  return processed;
}
