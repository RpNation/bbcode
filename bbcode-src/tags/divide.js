import { preprocessAttr, toNode } from "../utils/common";

export const divide = (node) => {
  const type = (preprocessAttr(node)._default || "").toLowerCase();
  return toNode(
    "div",
    {
      class: "bb-divide",
      "data-type": type,
    },
    node.content,
  );
};
