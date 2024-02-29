import { toNode } from "../utils/common";
/**
 * @file Adds [newspaper] to bbcode
 * @example [newspaper]content[/newspaper]
 */
export const newspaper = (node) => {
  return toNode("div", { class: "bb-newspaper" }, node.content);
};
