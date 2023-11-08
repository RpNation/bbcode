import { createPreset } from "@bbob/preset";
import { font } from "./tags/font";
import { nobr } from "./tags/nobr";
import { highlight } from "./tags/highlight";
import { alignmenttags } from "./tags/alignment";
import { inlinespoiler, spoiler } from "./tags/spoiler";

const tags = {
  font,
  nobr,
  ...alignmenttags,
  ...highlight,
  spoiler,
  inlinespoiler,
};

const availableTags = Object.keys(tags);

const preset = createPreset(tags);

export { availableTags, tags, preset };
export default preset;
