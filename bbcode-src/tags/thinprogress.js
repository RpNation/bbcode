import { preprocessAttr, toNode } from "../utils/common";

/**
 * @file Adds [thinprogress] to bbcode
 * @exmaple [thinprogress=percentageInt]content[/progthinprogressress]
 */
export const thinprogress = (node) => {
  const percentageInt = preprocessAttr(node.attrs)._default;
  return toNode("div", { class: "bb-progress-thin" }, [
    toNode("div", { class: "bb-progress-text" }, node.content),
    toNode("div", { class: "bb-progress-bar", style: `width: calc(${percentageInt}% - 6px)` }, ""),
    toNode("div", { class: "bb-progress-bar-other" }, ""),
  ]);
};
