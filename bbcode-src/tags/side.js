import { preprocessAttr, toNode } from "../utils/common";

export const side = (node) => {
  const attrs = preprocessAttr(node)._default || "left";
  return toNode("div", { class: "bb-side", "data-side": attrs }, node.content);
};
