import {
  MD_BROKEN_BLOCKQUOTE,
  MD_BROKEN_ORDERED_LIST,
  MD_BROKEN_UNORDERED_LIST,
  MD_NEWLINE_INJECT,
  MD_NEWLINE_INJECT_COMMENT,
  MD_NEWLINE_PRE_INJECT,
} from "./common";

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
    .replaceAll("\n" + MD_NEWLINE_INJECT_COMMENT, "")
    .replaceAll(MD_NEWLINE_INJECT_COMMENT + "\n", "")
    .replaceAll(MD_NEWLINE_INJECT_COMMENT, ""); // Remove all instances of the injected newline
  return processed;
}

function cleanMultilineMDBlocks(raw) {
  const processed = raw
    .replaceAll(MD_BROKEN_ORDERED_LIST, "")
    .replaceAll(MD_BROKEN_UNORDERED_LIST, "")
    .replaceAll(MD_BROKEN_BLOCKQUOTE, "");
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
 * Setups the class style tag template for the post
 * @param {string} raw
 * @param {{styles: string[]}} data - contains styles array
 * @returns string
 */
function createClassStyleTagTemplate(raw, data) {
  if (data.styles.length === 0) {
    return raw;
  }
  const template = '<template data-bbcode-plus="class">' + data.styles.join("\n") + "</template>";
  return template + raw;
}

/**
 * Setups the script tag template for the post
 * @param {string} raw
 * @param {{
 *  bbscripts: {
 *    id: string,
 *    class: string,
 *    on: string,
 *    version: string,
 *    content: string
 *  }[]}} data - contains scripts array
 * @returns string
 */
function createScriptTagTemplate(raw, data) {
  if (data.bbscripts.length === 0) {
    return raw;
  }
  const templates = data.bbscripts.map(
    (s) =>
      `<template data-bbcode-plus="script" data-bbscript-id="${s.id}" data-bbscript-class="${s.class}" data-bbscript-on="${s.on}" data-bbscript-ver="${s.version}">${s.content}</template>`,
  );
  return templates.join("") + raw;
}

/**
 * Performs post processing on the raw string to address any necessary functionality that BBob/MD can't handle with a plugin (i.e. hoisting).
 * @param {string} raw processed input from after bbob and md
 * @param {any} data from bbob data
 * @returns final processed string
 */
export function postprocess(raw, data) {
  let final = raw;
  const postprocessors = [
    removeNewlineInjects,
    createClassStyleTagTemplate,
    createScriptTagTemplate,
    cleanMultilineMDBlocks,
    renderHoistedCodeBlocks,
  ];
  for (const postprocessor of postprocessors) {
    final = postprocessor(final, data);
  }
  return final;
}
