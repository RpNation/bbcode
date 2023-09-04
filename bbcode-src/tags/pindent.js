/**
* @file Adds [pindent] to bbcode
* @example [pindent]content[/pindent]
*/
const toNode = (tag, attrs, content) => ({
    tag,
    attrs,
    content
});

const toStyle = (style) => ({ style });

export const pindent = {
    pindent: (node) => toNode('span', toStyle('display: inline-block; text-indent:2.5em'), node.content)
};