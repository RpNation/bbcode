import { availableTags, preset } from "./preset";
import bbob from "@bbob/core";
import { render } from "@bbob/html";
import { lineBreakPlugin } from "./plugins/lineBreak";

const data = [];

// const code = `[i][b]Text[/b][/i][font]test[/font][font=default attrtest]default[/font]`;
const options = {
  onlyAllowTags: [...availableTags, "nobr"],
  enableEscapeTags: true,
  onError: (err) =>
    // eslint-disable-next-line no-console
    console.warn(err.message, err.lineNumber, err.columnNumber),
  data,
};

// const bbobOutput = bbob(preset()).process(code, { render, ...options });

// console.log(bbobOutput);

// const html = bbobOutput.html;

// console.log(data);

// console.log(html); // <span style="font-style: italic;">Text</span>

export const RpNBBCode = (code) =>
  bbob([preset(), lineBreakPlugin()]).process(code, {
    render,
    ...options,
  });
// export default RpNBBCode;
