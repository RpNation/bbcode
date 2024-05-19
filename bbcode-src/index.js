import { availableTags, preset, preventParsing } from "./preset";
import bbob from "@bbob/core";
import { render } from "@bbob/html";
import { preserveWhitespace } from "./plugins/preserveWhitespace";
import { postprocess } from "./utils/postprocess";
import { lineBreakPlugin } from "./plugins/lineBreak";
import { preprocessRaw } from "./utils/preprocess";

// TODO: Change error handling so active editing doesn't spam the console
const options = {
  onlyAllowTags: [...availableTags],
  contextFreeTags: preventParsing, // prevent parsing of children
  enableEscapeTags: true,
  onError: (err) =>
    // eslint-disable-next-line no-console
    console.warn(err.message, err.lineNumber, err.columnNumber),
};

export const RpNBBCode = (code, opts) => {
  const plugins = [preset()];
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
      previewing: opts.previewing,
      fonts: new Set(),
    },
  });
};

export { postprocess };
