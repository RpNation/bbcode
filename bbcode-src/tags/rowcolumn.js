import { preprocessAttr, toNode } from "../utils/common";

/**
 * @file Adds [row][column] to bbcode
 * @example Adds [row][column][/column][/row]
 */
export const rowcolumn = {
  row: (node) => toNode("div", { class: "bb-row" }, node.content),
  column: (node) => {
    const columnAttrs = preprocessAttr(node.attrs)._default || "1";
    const columnStyle = columnAttrs.startsWith("span") ? `column-width-${columnAttrs}` : `column-width-span${columnAttrs}`;
      return toNode("div", { class: `bb-column`, "data-span": columnStyle }, node.content);
  }
};
