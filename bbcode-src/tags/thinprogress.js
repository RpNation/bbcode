
import { preprocessAttr, toNode } from "../utils/common";

/**
 * @file Adds [thinprogress] to bbcode
 * @exmaple [thinprogress=percentageInt]content[/progthinprogressress]
 */
export const thinprogress = (node) => {
    const percentageInt = preprocessAttr(node.attrs)._default;
    return {
        tag: "div",
        attrs: {
          class: "bb-progress-thin",
        },
        content: [
          {
            tag: "div",
            attrs: {
              class: "bb-progress-text"
            },
            content: node.content
          },
          {
            tag: "div",
            attrs: {
              class: "bb-progress-bar",
              style: `width: calc(${percentageInt}% - 6px)`
            }
          },
          {
            tag: "div",
            attrs: {
              class: "bb-progress-bar-other"
            }
          }
        ],
      };
}