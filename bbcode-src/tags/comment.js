import { toNode } from "../utils/common";

/**
 * @file Adds [comment] tag
 * @example [comment]Content[/comment]
 */

const comment = (node) => {
  return toNode("span", { class: "hidden" }, node.content);
};

export { comment };
