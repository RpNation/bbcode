import { preprocessAttr, toNode } from "../utils/common";

/**
 * Add [bg] tag
 * @example [bg=red]Hello[/bg]
 */
export const bg = (node) => {
  const color = preprocessAttr(node.attrs)._default;
  return toNode(
    "div",
    {
      style: `background-color: ${color};`,
      class: "bb-background",
    },
    node.content,
  );
};
