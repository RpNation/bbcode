import { createPreset } from "@bbob/preset";
import { alignment } from "./tags/alignment";
import { anchor } from "./tags/anchor";
import { bg } from "./tags/background";
import { block } from "./tags/block";
import { blockquote } from "./tags/blockquote";
import { border } from "./tags/border";
import { centerblock } from "./tags/centerblock";
import { check } from "./tags/check";
import { code, icode, savenl } from "./tags/code";
import { color } from "./tags/color";
import { comment } from "./tags/comment";
import { divide } from "./tags/divide";
import { fieldset } from "./tags/fieldset";
import { font } from "./tags/font";
import { h, h1, h2, h3, h4, h5, h6, sh } from "./tags/header";
import { heightrestrict } from "./tags/heightrestrict";
import { highlight } from "./tags/highlight";
import { imagefloat } from "./tags/imagefloat";
import { justify } from "./tags/justify";
import { mail } from "./tags/mail";
import { newspaper } from "./tags/newspaper";
import { br, nobr } from "./tags/lineBreak";
import { note } from "./tags/note";
import { ooc } from "./tags/ooc";
import { pindent } from "./tags/pindent";
import { plain } from "./tags/plain";
import { print } from "./tags/print";
import { progress } from "./tags/progress";
import { rowcolumn } from './tags/rowcolumn';
import { thinprogress } from "./tags/thinprogress";
import { scroll } from "./tags/scroll";
import { side } from "./tags/side";
import { size } from "./tags/size";
import { sub } from "./tags/subscript";
import { sup } from "./tags/superscript";
import { inlinespoiler, spoiler } from "./tags/spoiler";
import { textmessage } from "./tags/textmessage";
import { tab, tabs } from "./tags/tabs";
import { accordionTags } from "./tags/accordion";
import { div } from "./tags/div";
import { classStyle } from "./tags/class";
import { script } from "./tags/script";
import { animation, keyframe } from "./tags/animation";
import { bold, italic, strike, underline } from "./tags/discourse-core-replacement";

const tags = {
  ...accordionTags,
  ...alignment,
  ...anchor,
  animation,
  bg,
  block,
  blockquote,
  border,
  br,
  centerblock,
  check,
  class: classStyle,
  code,
  color,
  comment,
  div,
  divide,
  fieldset,
  font,
  h,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  heightrestrict,
  highlight,
  icode,
  imagefloat,
  inlinespoiler,
  justify,
  keyframe,
  mail,
  newspaper,
  nobr,
  note,
  ooc,
  pindent,
  plain,
  print,
  progress,
  ...rowcolumn,
  thinprogress,
  savenl,
  sh,
  script,
  scroll,
  side,
  size,
  spoiler,
  sub,
  sup,
  tab,
  tabs,
  ...textmessage,

  // discourse core replacement tags
  b: bold,
  i: italic,
  u: underline,
  s: strike,
};

const availableTags = Object.keys(tags);
const preventParsing = ["plain", "code", "icode", "class"];

const preset = createPreset(tags);

export { availableTags, tags, preset, preventParsing };
export default preset;
