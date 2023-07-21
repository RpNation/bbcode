import { createPreset } from "@bbob/preset";
import { bold } from "./tags/bold";
import { font } from "./tags/font";
import { nobr } from "./tags/nobr";

const tags = {
  b: bold,
  font,
  nobr,
};

const availableTags = Object.keys(tags);

const preset = createPreset(tags);

export { availableTags, tags, preset };
export default preset;
