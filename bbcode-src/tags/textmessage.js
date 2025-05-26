import { preprocessAttr, toNode } from "../utils/common";

/**
 * @file Adds textmessage to bbcode
 * @example [textmessage=Recipient][message=them]Hi [/message][message=me] Hey![/message][/textmessage]
 */

const ACCEPTED_OPTIONS = ["me", "them", "right", "left"];
export const textmessage = {
  textmessage: (node, options) => {
    const attr = preprocessAttr(node, options.data.raw)._default || "Recipient";
    const recipient = attr && attr.trim() !== "" ? attr : "Recipient";
    return toNode("div", { class: "bb-textmessage" }, [
      toNode("div", { class: "bb-textmessage-name" }, recipient),
      toNode("div", { class: "bb-textmessage-overflow" }, [
        toNode("div", { class: "bb-textmessage-content" }, node.content),
      ]),
    ]);
  },
  message: (node, options) => {
    // We should only parse a [message] tag if the [textmessage] tag exists
    if (options?.data?.raw?.toLowerCase().includes("[textmessage]")) {
      let option = preprocessAttr(node, options?.data?.raw)._default.toLowerCase();
      if (!ACCEPTED_OPTIONS.includes(option) || option === "right") {
        option = "me";
      }
      if (option === "left") {
        option = "them";
      }

      const senderAttrs = option === "me" ? "bb-message-me" : "bb-message-them";
      return toNode("div", { class: senderAttrs }, [
        toNode("div", { class: "bb-message-content" }, node.content),
      ]);
    }
    return `[${node.tag}]`;
  },
};
