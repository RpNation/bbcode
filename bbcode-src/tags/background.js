import { preprocessAttr, toNode } from "../utils/common";

export const bg = (node) => {
  const color = preprocessAttr(node.attrs)._default;
  return toNode(
    "div",
    {
      style: `background-color: ${color};`,
      class: "bb-background",
    },
    node.content
  );
};
