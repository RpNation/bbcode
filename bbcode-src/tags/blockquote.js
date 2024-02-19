import { preprocessAttr } from "../utils/common";

/**
 * @file Adds [blockquote] to bbcode
 * @example [blockquote=author]content[/blockquote]
 */
export const blockquote = (node) => {
  const author = preprocessAttr(node.attrs)._default || "";

  return {
    tag: "div",
    attrs: {
      class: "bb-blockquote",
    },
    content: [
      {
        tag: "div",
        attrs: {
          class: "bb-blockquote-left",
        },
      },
      {
        tag: "div",
        attrs: {
          class: "bb-blockquote-content",
        },
        content: [
          node.content,
          {
            tag: "div",
            attrs: {
              class: "bb-blockquote-speaker",
            },
            content: `${author !== "" ? `- ${author}` : ""}`,
          },
        ],
      },
      {
        tag: "div",
        attrs: {
          class: "bb-blockquote-right",
        },
      },
    ],
  };
};
