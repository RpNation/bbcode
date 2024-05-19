import { preprocessAttr, toNode } from "../utils/common";

export const style = (node, options) => {
  const attrs = preprocessAttr(node.attrs);
  const nameAttr = attrs.name || attrs._default;
};
