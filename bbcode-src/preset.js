import { createPreset } from "@bbob/preset";
import { alignment } from "./tags/alignment";
import { bg } from "./tags/background";
import { border } from "./tags/border";
import { check } from "./tags/check";
import { color } from "./tags/color";
import { divide } from "./tags/divide";
import { font } from "./tags/font";
import { nobr } from "./tags/nobr";
import { note } from "./tags/note";
import { ooc } from "./tags/ooc";
import { pindent } from "./tags/pindent";
import { inlinespoiler, spoiler } from "./tags/spoiler";

const tags = {
  ...alignment,
  bg,
  border,
  check,
  color,
  divide,
  font,
  h,
  highlight,
  inlinespoiler,
  justify,
  mail,
  newspaper,
  nobr,
  note,
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
