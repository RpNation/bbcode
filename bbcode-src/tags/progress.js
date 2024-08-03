import { preprocessAttr, toNode } from "../utils/common";

/**
 * @file Adds [progress] to bbcode
 * @exmaple [progress=percentageInt]content[/progress]
 */
export const progress = (node) => {
  const percentageInt = preprocessAttr(node)._default;
  return toNode("div", { class: "bb-progress" }, [
    toNode("div", { class: "bb-progress-text" }, node.content),
    toNode("div", { class: "bb-progress-bar", style: `width: calc(${percentageInt}% - 6px)` }, ""),
    toNode("div", { class: "bb-progress-bar-other" }, ""),
  ]);
};
