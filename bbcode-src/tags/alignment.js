/**
* @file Adds [left], [center], and [right] to bbcode
* @example [left]content[/left]
*/
const toNode = (tag, attrs, content) => ({
    tag,
    attrs,
    content
});

export const alignmenttags = {
    left: (node) => toNode('div', { class: 'bbcode-content-left' }, node.content),
    center: (node) => toNode('div', { class: 'bbcode-content-center' }, node.content),
    right: (node) => toNode('div', { class: 'bbcode-content-right' }, node.content)
};