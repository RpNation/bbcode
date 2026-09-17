import { isTagNode } from "@bbob/plugin-helper";
import { preprocessAttr, toNode, toRawTag } from "../utils/common";

// These are the variants supported by RpNation's XenForo table stylesheet.
const TABLE_STYLE = /^(?:(?:none|dotted|dark)(?:-zebra2?)?|zebra2?)$/;
const ROW_STYLES = new Set(["blue", "gray", "grey"]);
const ROW_TAGS = new Set(["tr"]);
const CELL_TAGS = new Set(["td", "th", "tf"]);

function hasUnexpectedContent(content, allowedTags) {
  return content.some((child) => {
    if (typeof child === "string") {
      return child.trim().length > 0;
    }
    return !isTagNode(child) || !allowedTags.has(child.tag.toLowerCase());
  });
}

function option(node, options) {
  return String(preprocessAttr(node, options.data.raw)._default || "")
    .trim()
    .toLowerCase();
}

function table(node, options) {
  if (node.gen) {
    return node;
  }

  const rows = node.content.filter((child) => isTagNode(child) && child.tag.toLowerCase() === "tr");
  if (
    !rows.length ||
    hasUnexpectedContent(node.content, ROW_TAGS) ||
    rows.some((row) => hasUnexpectedContent(row.content, CELL_TAGS))
  ) {
    // Invalid legacy tables can contain meaningful text outside their cells.
    // Keep their source visible instead of silently discarding that content.
    return toRawTag(node, options.data.raw);
  }
  rows.forEach((row) => (row.isBBCodeTableRow = true));

  const style = option(node, options);
  const attrs = { class: "bb-table" };
  if (TABLE_STYLE.test(style)) {
    attrs["data-bb-table-style"] = style;
  }
  return toNode("table", attrs, rows);
}

function tr(node, options) {
  if (node.gen) {
    return node;
  }
  if (!node.isBBCodeTableRow) {
    return toRawTag(node, options.data.raw);
  }

  const cells = node.content.filter(
    (child) => isTagNode(child) && CELL_TAGS.has(child.tag.toLowerCase())
  );
  cells.forEach((tableCell) => (tableCell.isBBCodeTableCell = true));

  const style = option(node, options);
  const attrs = {};
  if (ROW_STYLES.has(style)) {
    attrs["data-bb-table-row"] = style === "grey" ? "gray" : style;
  }
  return toNode("tr", attrs, cells);
}

function cell(node, options) {
  if (node.gen) {
    return node;
  }
  if (!node.isBBCodeTableCell) {
    return toRawTag(node, options.data.raw);
  }

  const tag = node.tag.toLowerCase();
  const attrs = tag === "tf" ? { class: "bb-table-footer" } : {};
  const span = option(node, options);
  // HTML colspans are positive integers, with a maximum of 1000.
  if (/^\d{1,4}$/.test(span) && Number(span) > 0 && Number(span) <= 1000) {
    attrs.colspan = String(Number(span));
  }
  return toNode(tag === "th" ? "th" : "td", attrs, node.content);
}

export const tableTags = { table, tr, td: cell, th: cell, tf: cell };
