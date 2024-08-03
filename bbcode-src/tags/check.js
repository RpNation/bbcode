import { preprocessAttr, toNode } from "../utils/common";

export const check = (node, options) => {
  const attrs = preprocessAttr(node, options.data.raw)._default || "dot";
  return toNode("div", { class: `bb-check`, "data-type": attrs }, node.content);
};
