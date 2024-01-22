const toNode = (tag, attrs, content) => ({
  tag,
  attrs,
  content,
});

/**
 * Preprocess attributes of a node to either combine all values into a single default value
 * or return a keyed attribute list
 * @param {any} attrs object of bbcode node attrs
 * @param {string[]} predefinedKeys array of predefined keys to be captured
 * @returns processed attributes
 */
const preprocessAttr = (attrs) => {
  const keys = Object.keys(attrs).join(" ");
  const vals = Object.values(attrs).join(" ");
  if (keys === vals) {
    return {
      _default: vals,
    };
  } else {
    return attrs;
  }
};

const MD_NEWLINE_INJECT = "\n<!-- bbcode injected newlines -->\n";

export { toNode, preprocessAttr, MD_NEWLINE_INJECT };
