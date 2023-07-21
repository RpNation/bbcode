export const bold = (node) => {
  // console.log(node);
  return {
    tag: "span",
    attr: { style: "font-weight: bold", 'data-rpn-bbcode': '' },
    content: node.content,
  };
};
