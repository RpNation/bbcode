import { availableTags, preset } from "./preset";
import bbob from "@bbob/core";
import { render } from "@bbob/html";
import { lineBreakPlugin } from "./plugins/lineBreak";

const data = [];

// TODO: Change error handling so active editing doesn't spam the console
const options = {
  onlyAllowTags: [...availableTags, "nobr"],
  enableEscapeTags: true,
  onError: (err) =>
    // eslint-disable-next-line no-console
    console.warn(err.message, err.lineNumber, err.columnNumber),
  data,
};

export const RpNBBCode = (code) =>
  bbob([preset(), lineBreakPlugin()]).process(code, {
    render,
    ...options,
  });
