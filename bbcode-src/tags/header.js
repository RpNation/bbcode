import { toNode } from "../utils/common";
/**
 * @file Adds Header to bbcode
 * @example [h]content[/h]
 */
export const h = (node) => {
  return toNode(
    "span",
    {
      class: "bb-header",
    },
    node.content
  );
};
