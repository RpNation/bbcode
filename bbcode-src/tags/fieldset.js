import { preprocessAttr, toNode } from "../utils/common";

/**
 * @file Adds [fieldset] to bbcode
 * @example [fieldset=title]content[/fieldset]
 */
export const fieldset = (node) => {
  const title = preprocessAttr(node.attrs)._default || "";
  return toNode("fieldset", { class: "bb-fieldset" }, [
    toNode("legend", { class: "bb-fieldset-legend" }, title),
    toNode("div", { class: "bb-fieldset" }, node.content),
  ]);
};
