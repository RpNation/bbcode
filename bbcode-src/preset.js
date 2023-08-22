import { createPreset } from "@bbob/preset";
import { font } from "./tags/font";
import { nobr } from "./tags/nobr";
import { leftCenterRight } from './tags/leftCenterRight';

const tags = {
  font,
  nobr,
  ...leftCenterRight
};

const availableTags = Object.keys(tags);

const preset = createPreset(tags);

export { availableTags, tags, preset };
export default preset;
