import { preprocessAttr, toNode } from "../utils/common";
/**
 * @file Adds [a] and [goto] to bbcode
 * @example [a=your_anchor_name]An anchor[/a] [goto=your_anchor_name]Jump to an anchor[/goto]
 */
export const anchor = {
  // name is not valid in HTML5; however, it correctly displays back while id does not
  a: (node, options) => {
    const attrs = preprocessAttr(node, options.data.raw)._default || "";
    return toNode(
      "a",
      { id: `user-anchor-${attrs.trim()}`, name: `user-anchor-${attrs.trim()}` },
      node.content,
    );
  },
  goto: (node, options) => {
    const attrs = preprocessAttr(node, options.data.raw)._default || "";
    return toNode("a", { href: `#user-anchor-${attrs.trim()}` }, node.content);
  },
};
