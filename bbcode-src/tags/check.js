import { preprocessAttr, toNode } from "../utils/common";

/**
 * @file Adds [check] to bbcode
 * @example [check]content[/check]
 */
export const check = (node) => {
  const attrs = preprocessAttr(node.attrs)._default;
  return toNode(
        "div", 
        { 
            // style: `content: ${val}`,
            class: "bb-check",
            "data-check": attrs 
        }, 
        node.content
    );
};