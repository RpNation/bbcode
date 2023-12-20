import { toNode } from "../utils/common";

export const ooc = (node) => {
  return toNode(
    "div",
    {
      class: "bb-ooc",
    },
    node.content
  );
};
