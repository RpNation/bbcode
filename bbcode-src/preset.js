import { createPreset } from "@bbob/preset";
import { font } from "./tags/font";
import { nobr } from "./tags/nobr";
import { alignmenttags } from './tags/alignment';

const tags = {
  font,
  nobr,
  ...alignmenttags
};

const availableTags = Object.keys(tags);

const preset = createPreset(tags);

export { availableTags, tags, preset };
export default preset;
