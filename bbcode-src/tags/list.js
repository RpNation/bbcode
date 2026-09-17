import { isStringNode } from "@bbob/plugin-helper";
import { preprocessAttr, toNode } from "../utils/common";

// XenForo's [*] is an item separator, not a paired BBCode tag. Split only
// strings here so nested lists and formatting nodes stay inside their item.
export const list = (node, options) => {
  const items = [];
  let content = [];

  function appendItem() {
    while (content.length && isStringNode(content[0]) && !content[0].trim()) {
      content.shift();
    }
    while (
      content.length &&
      isStringNode(content[content.length - 1]) &&
      !content[content.length - 1].trim()
    ) {
      content.pop();
    }
    if (content.length) {
      if (isStringNode(content[0])) {
        content[0] = content[0].trimStart();
      }
      const last = content.length - 1;
      if (isStringNode(content[last])) {
        content[last] = content[last].trimEnd();
      }
      items.push(toNode("li", {}, content));
    }
    content = [];
  }

  for (const child of node.content) {
    if (!isStringNode(child)) {
      content.push(child);
      continue;
    }
    const parts = child.split("[*]");
    content.push(parts[0]);
    for (const part of parts.slice(1)) {
      appendItem();
      content.push(part);
    }
  }
  appendItem();

  let style = String(preprocessAttr(node, options.data.raw)._default || "").trim();
  if (
    (style.startsWith("'") && style.endsWith("'")) ||
    (style.startsWith('"') && style.endsWith('"'))
  ) {
    style = style.slice(1, -1);
  }
  return toNode(style === "1" ? "ol" : "ul", {}, items);
};
