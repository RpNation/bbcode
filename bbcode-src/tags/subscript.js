import { toNode } from "../utils/common";

/**
 * @file Adds subscript to bbcode
 * @example [sub]content[/sub]
 */

const sub = () => {
  return toNode("sub", {}, null);
};

export { sub };
