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
  const title = preprocessAttr(node.attrs) || "Spoiler";

  /**
   * <content class="bb-spoiler">
   *  <summary>Title</summary>
   *  <div class="bb-spoiler-content">
   *    lorem ipsum
   *  </div>
   * </content>
   */
  return {
    tag: "content",
    attrs: {
      class: "bb-spoiler",
    },
    content: [
      {
        tag: "summary",
        content: title,
      },
      {
        tag: "div",
        attrs: {
          class: "bb-spoiler-content",
        },
        content: node.content,
      },
    ],
  };
};

export const inlinespoiler = (node) => {
  return toNode("span", { class: "bb-inline-spoiler" }, [
    { tag: "input", attrs: { type: "checkbox", class: "bb-inline-spoiler" } },
    ...node.content,
  ]);
};
