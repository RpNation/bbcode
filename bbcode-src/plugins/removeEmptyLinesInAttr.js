import { isTagNode } from "@bbob/plugin-helper";

// BBob drops control characters from attribute values, which would join the
// lines of a multi-line value (`border:1px\nsolid`) into one word
const LINE_BREAKS_REGEX = /\s*[\t\n\v\f\r]\s*/g;

/**
 * Replaces line breaks and tabs (and the whitespace around them) with a single space
 * @param {string} text
 */
const removeEmptyLines = (text) => {
  return text.replace(LINE_BREAKS_REGEX, " ");
};

/**
 * Removes line breaks from attributes
 * @type {import('@bbob/types').BBobPluginFunction}
 */
export const removeEmptyLinePlugin = (tree) => {
  return tree.walk((node) => {
    if (isTagNode(node) && node.attrs) {
      Object.keys(node.attrs).forEach((key) => {
        if (typeof node.attrs[key] === "string") {
          node.attrs[key] = removeEmptyLines(node.attrs[key]);
        }
      });
    }
    return node;
  });
};
