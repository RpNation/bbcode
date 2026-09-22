import bbob from "@bbob/core";
import { render } from "@bbob/html";
import { lineBreakPlugin } from "./plugins/lineBreak";
import { preserveWhitespace } from "./plugins/preserveWhitespace";
import { removeEmptyLinePlugin } from "./plugins/removeEmptyLinesInAttr";
import { availableTags, preset, preventParsing } from "./preset";
import { postprocess } from "./utils/postprocess";
import { preprocessRaw } from "./utils/preprocess";

const options = {
  onlyAllowTags: [...availableTags],
  caseFreeTags: true,
  contextFreeTags: preventParsing, // prevent parsing of children
  enableEscapeTags: true,
  onError: (err) => {
    if (options.previewing) {
      // eslint-disable-next-line no-console
      console.warn(err.message, err.lineNumber, err.columnNumber);
    }
  },
};
const presetTags = preset();

// BBob matches mixed-case tags but retains their spelling in the parsed tree.
// Preset handlers, including the internal saveNL tag, are keyed by lowercase names.
function normalizeTagNames(tree) {
  return tree.walk((node) => {
    if (node.tag) {
      node.tag = node.tag.toLowerCase();
    }
    return node;
  });
}
// Core handles its inline formatting unless a custom layout needs the BBCode tree.
const nativeInlineTags = new Set(["b", "i", "u", "s"]);
const customTagPattern = new RegExp(
  `\\[(?:${availableTags.filter((tag) => tag !== "savenl" && !nativeInlineTags.has(tag)).join("|")})(?=[\\s=\\]])`,
  "i"
);

export function containsBBCode(code) {
  // Hoist native fenced/inline code before deciding whether this post needs
  // legacy whitespace rules. A BBCode example is still ordinary Markdown.
  // Indented code can only start at the document start or after a blank line;
  // indentation continuing an ordinary paragraph is not a Markdown code block.
  // This is detection only: indenting nested tags in legacy layouts must not
  // turn those layouts into code when actual BBCode exists outside examples.
  const withoutIndentedCode = code
    .replace(/\r\n?/g, "\n")
    .replace(
      /(^|\n[ \t]*\n)(?:(?: {4}| {0,3}\t)[^\n]*(?:\n|$)|[ \t]*\n)+/g,
      "$1"
    );
  const [preprocessed] = preprocessRaw(withoutIndentedCode);
  return customTagPattern.test(preprocessed);
}

export const RpNBBCode = (code, opts) => {
  const plugins = [normalizeTagNames, presetTags];
  if (opts.preserveWhitespace) {
    plugins.push(preserveWhitespace());
  }
  plugins.push(lineBreakPlugin(), removeEmptyLinePlugin);
  const [preprocessed, preprocessedData] = preprocessRaw(code);
  return bbob(plugins).process(preprocessed, {
    render,
    ...options,
    data: {
      ...preprocessedData,
      raw: preprocessed,
      previewing: opts.previewing,
      fonts: new Set(),
      styles: [],
      bbscripts: [],
    },
  });
};

export { availableTags, postprocess };
