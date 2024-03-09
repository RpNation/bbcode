import { preprocessAttr, toNode } from "../utils/common";

export const centerblock = (node) => {
  const percentageInput = preprocessAttr(node.attrs)._default || "50";
  return toNode("div", { style: `margin: 0 auto; width: ${percentageInput}%` }, node.content);
};
