import { toNode } from "../utils/common";
/**
* @file Adds [left], [center], and [right] to bbcode
* @example [center]content[/center]
*/
export const alignmenttags = {
    left: (node) => toNode('div', { class: 'bb-left' }, node.content),
    center: (node) => toNode('div', { class: 'bb-center' }, node.content),
    right: (node) => toNode('div', { class: 'bb-right' }, node.content)
};