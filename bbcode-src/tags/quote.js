import { preprocessAttr } from "../utils/common";

/**
 * rebuild the [quote] tag so that markdown-it engine can parse it for itself
 */
export const quote = (node) => {
  const attrs = preprocessAttr(node.attrs);
  if (node.content[0] === "\n") {
    node.content.shift();
  }
  return [`\n[${node.tag}="${attrs._default}"]\n\n`, ...node.content, "\n\n[/quote]\n"];
};
