import { createPreset } from "@bbob/preset";
import { font } from "./tags/font";
import { nobr } from "./tags/nobr";
import { highlight } from "./tags/highlight";
import { alignment } from "./tags/alignment";
import { inlinespoiler, spoiler } from "./tags/spoiler";
import { color } from "./tags/color";
import { size } from "./tags/size";
import { bg } from "./tags/background";
import { border } from "./tags/border";
import { divide } from "./tags/divide";
import { ooc } from "./tags/ooc";
import { side } from "./tags/side";
import { pindent } from "./tags/pindent";
import { justify } from "./tags/justify";
import { check } from "./tags/check";

const tags = {
  ...alignment,
  bg,
  border,
  check,
  color,
  divide,
  font,
  highlight,
  inlinespoiler,
  justify,
  nobr,
  ooc,
  pindent,
  side,
  size,
  spoiler,
};

const availableTags = Object.keys(tags);

const preset = createPreset(tags);

export { availableTags, tags, preset };
export default preset;
