import { preprocessAttr, toNode } from "../utils/common";

export const divide = (node) => {
  const type = (preprocessAttr(node)._default || "").toLowerCase();
  return toNode(
    "span",
    {
      class: "bb-divide",
      "data-type": type,
    },
    node.content,
  );
};
