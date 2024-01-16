import { toNode } from "../utils/common";
/**
 * @file Adds [note] to bbcode
 * @example [note]content[/note]
 */

export const note = (node) => {
  return toNode("div", { class: "bb-note" }, [
    toNode("div", { class: "bb-note-tape" }, ""),
    toNode("div", { class: "bb-note-content" }, [
      node.content,
      toNode("div", { class: "bb-note-footer" }, ""),
    ]),
  ]);
};
