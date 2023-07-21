export const bold = (node) => {
  // console.log(node);
  return {
    tag: "span",
    attr: { style: "font-weight: bold" },
    content: node.content,
  };
};
