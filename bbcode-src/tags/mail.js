import { preprocessAttr, toNode } from "../utils/common";

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
