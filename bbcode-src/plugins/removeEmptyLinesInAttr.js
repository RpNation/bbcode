import { isTagNode } from "@bbob/plugin-helper";
const CONSECUTIVE_NEWLINE_REGEX = /\n{2,}/gm;

/**
 * Removes empty lines from a string
 * @param {string} text
 */
const removeEmptyLines = (text) => {
  return text.replace(CONSECUTIVE_NEWLINE_REGEX, "\n");
};

/**
 * Removes empty lines from attributes
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
