import { preprocessAttr, toNode } from "../utils/common";

export const centerblock = (node, options) => {
  const percentageInput = preprocessAttr(node, options.data.raw)._default || "50";
  return toNode("div", { style: `margin: 0 auto; width: ${percentageInput}%` }, node.content);
};
