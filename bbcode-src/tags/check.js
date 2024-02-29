import { preprocessAttr, toNode } from "../utils/common";

export const check = (node) => {
  const attrs = preprocessAttr(node.attrs)._default || "dot";
  return toNode("div", { class: `bb-check`, "data-type": attrs }, node.content);
};
