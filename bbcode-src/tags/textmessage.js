import { isTagNode } from "@bbob/plugin-helper";
import { preprocessAttr, toNode, toRawTag } from "../utils/common";

/**
 * @file Adds textmessage to bbcode
 * @example [textmessage=Recipient][message=them]Hi [/message][message=me] Hey![/message][/textmessage]
 */

const ACCEPTED_OPTIONS = ["me", "them", "right", "left"];
export const textmessage = {
  textmessage: (node, options) => {
    const messageList = node.content.filter(
      (contentNode) => isTagNode(contentNode) && contentNode.tag === "message"
    );
    messageList.forEach((messageNode) => {
      messageNode.isValid = true;
    });

    if (!messageList.length) {
      return toRawTag(node, options.data.raw);
    }

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
    if (!node.isValid) {
      return toRawTag(node, options.data.raw);
    }

    let option = preprocessAttr(node, options?.data?.raw)?._default?.toLowerCase();
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
