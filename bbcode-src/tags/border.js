import { preprocessAttr, toNode } from "../utils/common";

export const border = (node) => {
  const val = preprocessAttr(node.attrs)._default;
  return toNode(
    "div",
    {
      style: `border: ${val};`,
      class: "bb-border",
    },
    node.content
  );
};
