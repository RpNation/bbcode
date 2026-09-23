import { preprocessAttr } from "../utils/common";

/**
 * rebuild the [quote] tag so that markdown-it engine can parse it for itself
 */
export const quote = (node, options) => {
  const author = preprocessAttr(node, options.data.raw)._default;
  const open = author ? `[${node.tag}="${author}"]` : `[${node.tag}]`;
  return [`\n${open}\n\n`, ...node.content, "\n\n[/quote]\n"];
};
