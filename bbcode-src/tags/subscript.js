import { toNode } from "../utils/common";

/**
 * @file Adds subscript to BBCode
 * @example [sub]content[/sub]
 */

const sub = (node) => {
  return toNode("sub", {}, node.content);
};

export { sub };
