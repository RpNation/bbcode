import { preprocessAttr, toNode } from "../utils/common";
/**
 * @file Adds [mail] to bbcode
 * @param {string} [type="send"] Denotes type of mail either send or receive
 * @param {string} [person="Unknown"] Denotes the person in the To/From field
 * @param {string} [subject="Empty"] Denotes the subject line of the email
 * @example [mail type="send" person="John Doe" subject="Hello World"]content[/mail]
 */

const parseEmailContent = (content) => {
  return toNode("div", { class: "bb-email-content" }, content);
};

const parseEmailSubject = (subject) => {
  return toNode("div", { class: "bb-email-subject" }, subject);
};

const parseEmailPerson = (person) => {
  return toNode("div", { class: "bb-email-address" }, person);
};

const emailHeader = toNode("div", { class: "bb-email-header" }, "");
const emailFooter = toNode(
  "div",
  { class: "bb-email-footer" },
  toNode("div", { class: "bb-email-button" }, "")
);

export const mail = (node) => {
  const attributes = preprocessAttr(node.attrs);
  let mailAttr = {
    mailOption: (attributes.type || "send").toLowerCase(),
    person: attributes.person || "Unknown",
    subject: attributes.subject || "Empty",
  };

  return toNode(
    "div",
    {
      class: "bb-email",
      "data-bb-email": mailAttr.mailOption,
    },
    [
      emailHeader,
      parseEmailPerson(mailAttr.person),
      parseEmailSubject(mailAttr.subject),
      parseEmailContent(node.content),
      emailFooter,
    ]
  );
};
