import { toNode } from "../utils/common";

/**
 * @file Adds superscript to bbcode
 * @example [sup]content[/sup]
 */

const sup = (node) => {
  return toNode("sup", {}, node.content);
};

export { sup };
