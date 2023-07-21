/**
 * Plugin that converts line breaks to `<br/>` tags.
 * To use, put as function similar to the presets.
 *
 * If a node is marked with `noLineBreakConversion`, then it'll skip the parsing the children
 *
 * @example
 * ```ts
 * const output = bbob([preset(), lineBreakPlugin()]).process(input, {render}).html
 * ```
 */
import { isEOL } from "@bbob/plugin-helper";

/**
 * Checks if input is an object
 * @param value input
 * @returns if value is an object
 */
const isObj = (value) => typeof value === "object";

/**
 * Walks the tree of nodes. Will convert `\n` to `br` tag in format that can be used in any renderer.
 * If a node has the property noLineBreakConversion is encountered, will skip parsing children.
 * @param t tree of nodes to be processed
 * @returns modified tree
 */
const walk = (t) => {
  const tree = t;

  if (Array.isArray(tree)) {
    for (let idx = 0; idx < tree.length; idx++) {
      const child = walk(tree[idx]);
      if (Array.isArray(child)) {
        tree.splice(idx, 1, ...child);
        idx += child.length;
      } else {
        tree[idx] = child;
      }
    }
  } else if (tree && isObj(tree) && tree.content) {
    if (tree.disableLineBreakConversion) {
      // stop walk. children won't be parsed to have <br>
      return tree.tag ? tree : tree.content;
    }
    walk(tree.content);
  }

  if (isEOL(tree)) {
    return { tag: "br", content: null };
  }

  return tree;
};

/**
 * Converts `\n` to `<br/>` self closing tag. Supply this as the last plugin in the preset lists
 *
 * @example converts all line breaks to br
 * ```ts
 * const output = bbob([preset(), lineBreakPlugin()]).process(input, {render}).html
 * ```
 * @example will not convert line breaks inside [nobr]
 * ```ts
 * const nobr = (node: TagNode) => {return { disableLineBreakConversion: true, content: node.content }}; \\ tag in preset
 * ...
 * const output = bbob([preset(), lineBreakPlugin()]).process(input, {render}).html
 * ```
 * @returns plugin to be used in BBob process
 */
export const lineBreakPlugin = () => {
  return (tree) => walk(tree);
};
