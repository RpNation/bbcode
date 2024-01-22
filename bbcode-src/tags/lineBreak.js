import { toNode } from "../utils/common";

/**
 * Creates a line break html <br/> tag
 */
export const br = () => {
  return toNode("br", {}, null);
};

/**
 * Disables line breaks for given content
 * @example
 * ```
 * [nobr]test
 * test
 * test
 * [/nobr]
 *
 * test test test
 * ```
 */
export const nobr = (node) => {
  return { disableLineBreakConversion: true, content: node.content };
};
