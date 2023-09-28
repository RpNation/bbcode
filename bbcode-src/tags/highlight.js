/**
* @file Adds [highlight] to bbcode
* @example [highlight]content[/highlight]
*/
const toNode = (tag, attrs, content) => ({
    tag,
    attrs,
    content
});

export const highlight = {
    highlight: (node) => toNode('span', { class: 'bbcodeHighlight' }, node.content),
};