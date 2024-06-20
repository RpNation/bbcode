import { preprocessAttr, toNode } from "../utils/common";
/**
 * @file Adds [spoiler] and [inlinespoiler] to bbcode
 *
 * Defaults to "Spoiler" name if no title provided
 *
 * @example `[spoiler=Title]text[/spoiler]`
 * @example `[inlinespoiler]hidden content[/inlinespoiler]
 */

export const spoiler = (node) => {
  const providedTitle = preprocessAttr(node.attrs)._default;
  const title = "Spoiler" + (providedTitle ? `: ${providedTitle}` : "");

  /**
   * <details class="bb-spoiler">
   *  <summary>Title</summary>
   *  <div class="bb-spoiler-content">
   *    lorem ipsum
   *  </div>
   * </details>
   */
  return toNode("details", { class: "bb-spoiler" }, [
    toNode("summary", {}, title),
    toNode("div", { class: "bb-spoiler-content" }, node.content),
  ]);
};

export const inlinespoiler = (node) => {
  return toNode("span", { class: "bb-inline-spoiler" }, node.content);
};
