import { preprocessAttr, toNode } from "../utils/common";
/**
 * @file Adds [id] and [goto] to bbcode
 * @example [a=your_anchor_name]An anchor[/a] [goto=your_anchor_name]Jump to an anchor[/goto]
 */
export const anchor = {
    // name is not valid in HTML5; however, it correctly displays back while id does not
    a: (node) => toNode("a", { id: `user-anchor-${preprocessAttr(node.attrs)._default}`, name: `user-anchor-${preprocessAttr(node.attrs)._default}` }, node.content),
    goto: (node) => toNode("a", { href: `#user-anchor-${preprocessAttr(node.attrs)._default}` }, node.content)
};
