const toNode = (tag, attrs, content) => ({
    tag,
    attrs,
    content
});

const toStyle = (style) => ({ style });

export const leftCenterRight = {
    left: (node) => toNode('span', toStyle('text-align: left;'), node.content),
    center: (node) => toNode('span', toStyle('text-align: center;'), node.content),
    right: (node) => toNode('span', toStyle('text-align: right;'), node.content)
};