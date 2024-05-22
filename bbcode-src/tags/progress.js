import { preprocessAttr } from "../utils/common";

/**
 * @file Adds [progress] to bbcode
 * @exmaple [progress=percentageInt]content[/progress]
 */
export const progress = (node) => {
  const percentageInt = preprocessAttr(node.attrs)._default;
  return {
    tag: "div",
    attrs: {
      class: "bb-progress",
    },
    content: [
      {
        tag: "div",
        attrs: {
          class: "bb-progress-text",
        },
        content: node.content,
      },
      {
        tag: "div",
        attrs: {
          class: "bb-progress-bar",
          style: `width: calc(${percentageInt}% - 6px)`,
        },
      },
      {
        tag: "div",
        attrs: {
          class: "bb-progress-bar-other",
        },
      },
    ],
  };
};
