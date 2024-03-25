import { preprocessAttr, toNode } from "../utils/common";

/**
 * @file Adds textmessage to bbcode
 * @exmaple [textmessage=Recipient][message=them]Hi [/message][message=me] Hey![/message][/textmessage]
 */
export const textmessage = {
  textmessage: (node) => {
    const messageName = preprocessAttr(node.attrs)._default || "";
    return toNode("div", { class: "bb-textmessage" }, messageName);
  },
  message: (node) => {
    const recipient = preprocessAttr(node.attrs)._default;
    const recipientStyle = recipient.startsWith("me") ? "bb-message-me" : "bb-message-them";
    return {
      tag: "div",
      attrs: {
        class: "bb-textmessage-content",
      },
      content: [
        {
          tag: "div",
          attrs: {
            class: "bb-textmessage-overflow",
          },
          content: [
            {
              tag: "div",
              attrs: {
                class: recipientStyle,
              },
              content: node.content,
            },
          ],
        },
      ],
    };
  },
};
