import { toNode } from "../utils/common";
/**
 * @file Adds [pindent] to bbcode
 * @example [pindent]content[/pindent]
 */
export const pindent = (node) => {
  return toNode("span", { class: "bb-pindent" }, node.content);
};
