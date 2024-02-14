import { toNode } from "../utils/common";

/**
 * @file Adds subscript to bbcode
 * @example [sub]content[/sub]
 */

const sub = (node) => {
  return toNode(
    "sub",
    { style: "font-variant-position: sub;" },
    node.content
  );
};

export { sub };
