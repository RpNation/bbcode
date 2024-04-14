import { preprocessAttr } from "../utils/common";

/**
 * processes [code] tag and returns a fenced code block
 */
export const code = (node) => {
  const lang = preprocessAttr(node.attrs)._default || "bbcode";
  return {
    isWhitespaceSensitive: true,
    content: ["```" + lang + "\n", node.content, "\n```\n"],
  };
};

/**
 * processes [icode] tag and returns inline code
 */
export const icode = (node) => {
  return {
    isWhitespaceSensitive: true,
    content: ["`", node.content, "`"],
  };
};

/**
 * Special tag to save newlines in code blocks. Used for hoisting code blocks
 */
export const savenl = (node) => {
  return {
    isWhitespaceSensitive: true,
    content: node.content,
  };
};
