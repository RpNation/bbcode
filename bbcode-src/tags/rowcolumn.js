import { preprocessAttr, toNode } from "../utils/common";

/**
 * @file Adds [row][column] to bbcode
 * @example Adds [row][column][/column][/row]
 */
export const rowcolumn = {
  row: (node) => toNode("div", { class: "bb-row" }, node.content),
  column: (node) => {
    const columnAttrs = preprocessAttr(node.attrs)._default || "";
    const columnStyle = columnAttrs.startsWith("span")
      ? `bb-column column-width-${columnAttrs}`
      : `bb-column column-width-span${columnAttrs}`;
    return toNode("div", { class: `bb-column ${columnStyle}` }, node.content);
  },
};
