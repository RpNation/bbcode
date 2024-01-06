import { preprocessAttr, toNode } from "../utils/common";

/**
 * @file Adds [check] to bbcode
 * @example [check]content[/check]
 */
export const check = (node) => {
  const type = preprocessAttr(node.attrs)._default;
  return toNode(
        "div", 
        { 
            class: `bb-check`
            //class: `bb-check bb-check-${type}`
        }, 
        node.content
    );
};