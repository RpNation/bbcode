import { toNode } from "../utils/common";

/**
 * @file Adds superscript to bbcode
 * @example [sup]content[/sup]
 */

const sup = (node) => {
  return toNode(
    "sup",
    { style: "font-variant-position: super;" },
    node.content
  );
};

export { sup };
