import { toNode } from "../utils/common";
/**
* @file Adds [highlight] to bbcode
* @example [highlight]content[/highlight]
*/
export const highlight = (node) => {
    return toNode('span', { class: 'bb-highlight' }, node.content);
};