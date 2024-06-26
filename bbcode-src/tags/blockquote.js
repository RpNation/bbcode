import { preprocessAttr, toNode } from "../utils/common";

/**
 * @file Adds [blockquote] to bbcode
 * @example [blockquote=author]content[/blockquote]
 */
export const blockquote = (node) => {
  const author = preprocessAttr(node.attrs)._default || "";

  return toNode("div", { class: "bb-blockquote" }, [
    toNode("div", { class: "bb-blockquote-left" }),
    toNode("div", { class: "bb-blockquote-content" }, [
      node.content,
      toNode("div", { class: "bb-blockquote-speaker" }, author !== "" ? `- ${author}` : ""),
    ]),
    toNode("div", { class: "bb-blockquote-right" }),
  ]);
};
