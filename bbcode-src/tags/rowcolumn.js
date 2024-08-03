import { preprocessAttr, toNode } from "../utils/common";

/**
 * @file Adds [row][column] to bbcode
 * @example Adds [row][column][/column][/row]
 */
export const rowcolumn = {
  row: (node) => toNode("div", { class: "bb-row" }, node.content),
  column: (node, options) => {
    const columnAttrs = preprocessAttr(node, options.data.raw)._default || "8";
    const columnStyle = columnAttrs.startsWith("span")
      ? `column-width-${columnAttrs}`
      : `column-width-span${columnAttrs}`;
    return toNode("div", { class: `bb-column`, "data-span": columnStyle }, node.content);
  },
};
