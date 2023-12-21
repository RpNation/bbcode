import { preprocessAttr, toNode } from "../utils/common";

export const side = (node) => {
  const attrs = preprocessAttr(node.attrs)._default || "left";
  return toNode("div", { class: "bb-side", "data-side": attrs }, node.content);
};
