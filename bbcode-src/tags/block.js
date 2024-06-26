import { preprocessAttr, toNode } from "../utils/common";

/**
 * Add [block] tag
 * @example [block=treasure]content[/block]
 */
export const block = (node) => {
  const defaultOp = "block";
  const blockAttr = (preprocessAttr(node.attrs)._default || defaultOp).toLowerCase();

  const OPTIONS = [
    "block",
    "dice",
    "dice10",
    "setting",
    "warning",
    "storyteller",
    "announcement",
    "important",
    "question",
    "encounter",
    "information",
    "character",
    "treasure",
  ];

  // Default to block option if user did not provide anything valid
  const blockOption = OPTIONS.includes(blockAttr) ? blockAttr : defaultOp;

  return toNode("table", { class: "bb-block", "data-bb-block": blockOption }, [
    toNode("tbody", [
      toNode("tr", [
        toNode("td", { class: "bb-block-icon" }),
        toNode("td", { class: "bb-block-content" }, node.content),
      ]),
    ]),
  ]);
};
