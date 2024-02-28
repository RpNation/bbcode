import { toNode } from "../utils/common";

/**
 * @file Adds superscript to bbcode
 * @example [sup]content[/sup]
 */

const sup = () => {
  return toNode("sup", {}, null);
};

export { sup };
