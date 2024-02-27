import { toNode } from "../utils/common";

/**
 * @file Adds subscript to bbcode
 * @example [sub]content[/sub]
 */

const sub = () => {
  return tonode("sub", {}, null);
};

export { sub };
