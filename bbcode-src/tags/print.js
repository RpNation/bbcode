import { preprocessAttr, toNode } from "../utils/common";

/**
 * Add [print] tag
 * @example [print=lined]content[/print]
 */
export const print = (node) => {
  const defaultOp = "print";
  const printAttr = (preprocessAttr(node)._default || defaultOp).toLowerCase();

  const OPTIONS = ["print", "line", "graph", "parchment"];

  // Default to print if option is not valid
  const printOption = OPTIONS.includes(printAttr) ? printAttr : defaultOp;

  return toNode(
    "div",
    { class: printOption === defaultOp ? `bb-print` : `bb-print-${printOption}` },
    node.content,
  );
};
