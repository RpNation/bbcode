import { toNode } from "../utils/common";

/**
 * @file Adds [ooc] to bbcode
 * @example [ooc]content[/ooc]
 */
export const ooc = (node) => {
  return toNode(
    "div",
    {
      class: "bb-ooc",
    },
    node.content,
  );
};
