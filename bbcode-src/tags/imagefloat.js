import { preprocessAttr, toNode } from "../utils/common";
/**
 * @file Adds [imagefloat] to bbcode
 * @exmaple [imagefloat=left]content[/imagefloat]
 */
export const imagefloat = (node) => {
  const attrs = preprocessAttr(node.attrs)._default || "";
  return toNode("div", { class: `bb-float-${attrs}` }, node.content);
};
