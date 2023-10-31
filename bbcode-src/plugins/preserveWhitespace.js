/**
 * Plugin that converts consecutive normal spaces (U+0020) to non-breaking spaces (U+00A0).
 * To use, put as function similar to the presets.
 *
 *
 * @example
 * ```ts
 * const output = bbob([preset(), , preserveWhitespace(), lineBreakPlugin()]).process(input, {render}).html
 * ```
 */
import { isStringNode } from "@bbob/plugin-helper";

/**
 * Checks if input is an object
 * @param value input
 * @returns if value is an object
 */
const isObj = (value) => typeof value === "object";

/**
 * Walks the tree of nodes. Checks for node of consecutive spaces. If found replaces every space in
 * node with a nonbreaking space.
 * Preserves multiple spaces so html won't truncate them.
 *
 * Walks through entire tree.
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
        idx += child.length - 1;
      } else {
        tree[idx] = child;
      }
    }
  } else if (tree && isObj(tree) && tree.content) {

    walk(tree.content);
  }

  //Bbob breaks up nodes by the presence of normal spaces.
  //So a node with a normal space can only have normal spaces in that node.
  if (isStringNode(tree)) {
    if(tree.length > 1 && tree[0] === " ") {
      let numSpaces = tree.length;
      return [String.fromCharCode(160).repeat(numSpaces)];
    }
  }

  return tree;
};

/**
 * Converts consecutive normal spaces (U+0020) to nonbreaking spaces (U+00A0).
 * Supply this as a plugin in the preset lists.
 *
 * @example converts consecutive normal spaces (U+0020) to nonbreaking spaces (U+00A0)
 * ```ts
 * const output = bbob([preset(), preserveWhitespace(), lineBreakPlugin()]).process(input, {render}).html
 * ```
 *
 * @returns plugin to be used in BBob process
 */
export const preserveWhitespace = () => {
  return (tree) => walk(tree);
};
