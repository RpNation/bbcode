import { preprocessAttr, toNode } from "../utils/common";

/**
 * Add [bg] tag
 * @example [bg=red]Hello[/bg]
 */
export const bg = (node, options) => {
  const color = preprocessAttr(node, options.data.raw)._default;
  return toNode(
    "div",
    {
      style: `background-color: ${color};`,
      class: "bb-background",
    },
    node.content,
  );
};
