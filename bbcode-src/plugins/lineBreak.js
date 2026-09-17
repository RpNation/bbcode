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
import { MD_NEWLINE_INJECT, MD_NEWLINE_PRE_INJECT, URL_REGEX_SINGLE_LINE } from "../utils/common";

const isObj = (value) => typeof value === "object";
const isString = (value) => typeof value === "string";

/**
 * Walks the tree of nodes. Will add `br` tag to all `\n` in format that can be used in any renderer.
 * Preserves \n so that markdown-it doesn't try to treat everything like a block
 *
 * If a node has the property noLineBreakConversion is encountered, will skip parsing children.
 * @param t tree of nodes to be processed
 * @returns modified tree
 */
const walk = (t, disableLineBreakConversion = false, preserveHeadingText = false) => {
  let tree = t;

  if (isString(tree) && preserveHeadingText) {
    // Text such as "# character sheet" is a small literal label in legacy
    // layouts. Encode its first hash before Markdown's block rules run; inline
    // entity parsing restores the original text without creating a heading.
    // This never rewrites attributes, code examples or Markdown outside layouts.
    tree = tree.replace(/^([ \t]*)(#{1,6})(?=[ \t\r\n]|$)/gm, (_, indent, hashes) => {
      return `${indent}&#35;${hashes.slice(1)}`;
    });
  }

  if (Array.isArray(tree)) {
    reduceWordsToLines(tree);
    if (tree.some(isString)) {
      // array contains strings. Might be md compatible
      tree.unshift(MD_NEWLINE_INJECT);
      tree.push(MD_NEWLINE_INJECT);
    }
    for (let idx = 0; idx < tree.length; idx++) {
      const child = walk(tree[idx], disableLineBreakConversion, preserveHeadingText);
      if (Array.isArray(child)) {
        tree.splice(idx, 1, ...child);
        idx += child.length - 1;
      } else {
        tree[idx] = child;
      }
    }
  } else if (tree && isObj(tree) && tree.content) {
    if (tree.isWhitespaceSensitive) {
      // applies only to [code] and [icode]
      // stop walk. children won't be parsed to have <br>
      return tree.tag ? tree : tree.content;
    }
    if (tree.disableLineBreakConversion) {
      disableLineBreakConversion = true;
    }
    // Only author-created DIVs and NOBR regions own their heading typography.
    // Generated DIVs (spoilers, quotes, etc.) do not change Markdown semantics.
    preserveHeadingText ||= tree.preserveHeadingText || tree.attrs?.["data-bbcode-div"] === "true";
    walk(tree.content, disableLineBreakConversion, preserveHeadingText);
    return tree.tag ? tree : tree.content;
  } else if (isString(tree) && URL_REGEX_SINGLE_LINE.test(tree.trim())) {
    // if the entire string is a URL, then it should be prepared for onebox.
    // BBob separates strings by newlines anyway, so we can already assume this is sitting on its own line
    // MD_NEWLINE_INJECT is already replacing newline came before or the start of the array,
    // so we only need to make sure \n\n is added after the URL
    return [tree, MD_NEWLINE_PRE_INJECT];
  }

  if (isString(tree) && isEOL(tree)) {
    return disableLineBreakConversion
      ? ["\n", MD_NEWLINE_INJECT]
      : [{ tag: "br", content: null }, MD_NEWLINE_INJECT];
  }

  return tree;
};

/**
 * Reduces the list into lines, so that we can process them by line.
 * Performs in place.
 * @param {(string|Object)[]} words
 */
const reduceWordsToLines = (words) => {
  let rightIdx = words.findLastIndex((w) => isString(w) && !isEOL(w)) + 1;

  for (let i = rightIdx - 1; i >= 0; i--) {
    if (isString(words[i]) && !isEOL(words[i])) {
      continue;
    }
    if (isEOL(words[i])) {
      if (i !== rightIdx - 1) {
        words.splice(i + 1, rightIdx - i - 1, words.slice(i + 1, rightIdx).join(""));
      }
      rightIdx = i;
      continue;
    }
    if (isObj(words[i])) {
      if (i !== rightIdx - 1) {
        words.splice(i + 1, rightIdx - i - 1, words.slice(i + 1, rightIdx).join(""));
      }
      rightIdx = i;
    }
  }

  if (0 !== rightIdx) {
    words.splice(0, rightIdx, words.slice(0, rightIdx).join(""));
  }
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
