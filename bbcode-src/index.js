import { availableTags, preset } from "./preset";
import bbob from "@bbob/core";
import { render } from "@bbob/html";
import { preserveWhitespace } from "./plugins/preserveWhitespace";
import { lineBreakPlugin } from "./plugins/lineBreak";

// TODO: Change error handling so active editing doesn't spam the console
const options = {
  onlyAllowTags: [...availableTags, "nobr"],
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
  return bbob(plugins).process(code, {
    render,
    ...options,
    data: {
      fonts: new Set(),
    },
  });
};
