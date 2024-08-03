import { preprocessAttr, toNode } from "../utils/common";

export const border = (node, options) => {
  const val = preprocessAttr(node, options.data.raw)._default;
  return toNode(
    "div",
    {
      style: `border: ${val};`,
      class: "bb-border",
    },
    node.content,
  );
};
