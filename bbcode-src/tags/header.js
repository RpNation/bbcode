import { toNode } from "../utils/common";

/**
 * @file Adds Header to bbcode
 * @example [h]content[/h], [h2]content[/h2], [h3]content[/h3],
 * [h4]content[/h4], [h5]content[/h5], [h6]content[/h6].
 */

const h = (node) => {
  return toNode(
    "h1",
    {
      class: "bb-header",
    },
    node.content
  );
};

const h2 = (node) => {
  return toNode(
    "h2",
    {
      class: "bb-header-2",
    },
    node.content
  );
};

const h3 = (node) => {
  return toNode(
    "h3",
    {
      class: "bb-header-3",
    },
    node.content
  );
};

const h4 = (node) => {
  return toNode(
    "h4",
    {
      class: "bb-header-4",
    },
    node.content
  );
};

const h5 = (node) => {
  return toNode(
    "h5",
    {
      class: "bb-header-5",
    },
    node.content
  );
};

const h6 = (node) => {
  return toNode(
    "h6",
    {
      class: "bb-header-6",
    },
    node.content
  );
};

export { h, h2, h3, h4, h5, h6 };
