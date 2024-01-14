import { toNode } from "../utils/common";
/**
 * @file Adds subheader to bbcode
 * @example [sh]content[/sh]
 */
export const sh = (node) => {
  return toNode(
    "span",
    {
      class: "bb-sub-header",
    },
    node.content
  );
};
