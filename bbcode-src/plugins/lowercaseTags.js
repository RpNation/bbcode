import { isTagNode } from "@bbob/plugin-helper";

/**
 * Lowercases tag names so `[CENTER]` finds the `center` preset tag.
 * `caseFreeTags` only makes the parser match tags case-insensitively; since
 * BBob 4.4 the nodes keep the name as written. Must run before the preset.
 * @type {import('@bbob/types').BBobPluginFunction}
 */
export const lowercaseTagsPlugin = (tree) => {
  return tree.walk((node) => {
    if (isTagNode(node)) {
      node.tag = node.tag.toLowerCase();
    }
    return node;
  });
};
