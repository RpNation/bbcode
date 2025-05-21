import bbob from "@bbob/core";
import { render } from "@bbob/html";
import { lineBreakPlugin } from "./plugins/lineBreak";
import { preserveWhitespace } from "./plugins/preserveWhitespace";
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

export const RpNBBCode = (code, opts) => {
  const plugins = [presetTags];
  if (opts.preserveWhitespace) {
    plugins.push(preserveWhitespace());
  }
  plugins.push(lineBreakPlugin());
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

export { postprocess };
