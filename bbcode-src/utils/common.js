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

const MD_NEWLINE_INJECT = "<!-- bbcode injected newlines -->\n\n";
const MD_NEWLINE_PRE_INJECT = "\n\n<!-- bbcode pre injected newlines -->";

const URL_REGEX =
  /(http|ftp|https|upload):\/\/([\w_-]+(?:(?:\.[\w_-]+)+))([\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])/;
const MD_URL_REGEX =
  /\!?\[.*\]\((http|ftp|https|upload):\/\/([\w_-]+(?:(?:\.[\w_-]+)+))([\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])\)/;
const URL_REGEX_SINGLE_LINE = new RegExp(
  `^${URL_REGEX.source}|${MD_URL_REGEX.source}$`
);

export {
  toNode,
  preprocessAttr,
  MD_NEWLINE_INJECT,
  MD_NEWLINE_PRE_INJECT,
  URL_REGEX,
  MD_URL_REGEX,
  URL_REGEX_SINGLE_LINE,
};
