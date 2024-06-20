import { preprocessAttr, toNode } from "../utils/common";

/**
 * @file Adds textmessage to bbcode
 * @exmaple [textmessage=Recipient][message=them]Hi [/message][message=me] Hey![/message][/textmessage]
 */

const ACCEPTED_OPTIONS = ["me", "them", "right", "left"];
export const textmessage = {
  textmessage: (node) => {
    const attr = preprocessAttr(node.attrs)._default || "Recipient";
    const recipient = attr && attr.trim() !== "" ? attr : "Recipient";
    return toNode("div", { class: "bb-textmessage" }, [
      toNode("div", { class: "bb-textmessage-name" }, recipient),
      toNode("div", { class: "bb-textmessage-overflow" }, [
        toNode("div", { class: "bb-textmessage-content" }, node.content),
      ]),
    ]);
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
    return toNode("div", { class: senderAttrs }, [
      toNode("div", { class: "bb-message-content" }, node.content),
    ]);
  },
};
