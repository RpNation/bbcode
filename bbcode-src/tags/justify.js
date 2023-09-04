/**
* @file Adds [justify] to bbcode
* @example [justify]content[/justify]
*/
const toNode = (tag, attrs, content) => ({
    tag,
    attrs,
    content
});

export const justify = {
    justify: (node) => toNode('div', { class: 'bbcode-justify' }, node.content)
};