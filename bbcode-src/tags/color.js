import { preprocessAttr, toNode } from "../utils/common";

export const color = (node) => {
  const inputColor = preprocessAttr(node.attrs)._default || "";
  if (inputColor.trim() === "") {
    return node.content;
  }
  return toNode("span", { style: `color: ${inputColor}` }, node.content);
};
