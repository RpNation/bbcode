// import { getUniqAttr } from "@bbob/plugin-helper";

export const font = (node, options) => {
  // console.log(node);
  // console.log(node.attrs);
  // console.log(getUniqAttr(node.attrs));
  // options.data = [...options.data, 1];
  // eslint-disable-next-line no-console
  console.log(options);
  return {
    tag: "span",
    content: node.content,
  };
};
