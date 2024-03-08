import { preprocessAttr, toNode } from "../utils/common";
/**
 * @file Adds [id] and [goto] to bbcode
 * @example [a=your_anchor_name]An anchor[/a] [goto=your_anchor_name]Jump to an anchor[/goto]
 */
export const anchor = {
    a: (node) => toNode("a", { id: `user-anchor-${preprocessAttr(node.attrs)._default}` }, node.content),
    goto: (node) => toNode("a", { href: `#user-anchor-${preprocessAttr(node.attrs)._default}` }, node.content)
};
