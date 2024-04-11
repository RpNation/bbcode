import { preprocessAttr } from "../utils/common";

/**
 * @file Adds textmessage to bbcode
 * @exmaple [textmessage=Recipient][message=them]Hi [/message][message=me] Hey![/message][/textmessage]
 */

const ACCEPTED_OPTIONS = ["me", "them", "right", "left"];
export const textmessage = {
  textmessage: (node) => {
    const attr = preprocessAttr(node.attrs)._default || "Recipient";
    const recipient = attr && attr.trim() !== "" ? attr : "Recipient";
    return {
      tag: "div",
      attrs: {
        class: "bb-textmessage",
      },
      content: [
        {
          tag: "div",
          attrs: {
            class: "bb-textmessage-name",
          },
          content: recipient,
        },
        {
          tag: "div",
          attrs: {
            class: "bb-textmessage-overflow",
          },
          content: [
            {
              tag: "div",
              attrs: {
                class: "bb-textmessage-content",
              },
              content: node.content,
            },
          ],
        },
      ],
    };
  },
  message: (node) => {
    let option = preprocessAttr(node.attrs)._default.toLowerCase();
    if (!ACCEPTED_OPTIONS.includes(option) || option === "right") {
      option = "me";
    }
    if (option === "left") {
      option = "them";
    }

    const senderAttrs = option === "me" ? "bb-message-me" : "bb-message-them";
    return {
      tag: "div",
      attrs: {
        class: senderAttrs,
      },
      content: [
        {
          tag: "div",
          attrs: {
            class: "bb-message-content",
          },
          content: node.content,
        },
      ],
    };
  },
};
