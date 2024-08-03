import { preprocessAttr, toNode } from "../utils/common";

/**
 * Adds [div] tag
 * [div=css]Content[/div]
 * [div class="class" style="css"]Content[/div]
 */
export const div = (node, options) => {
  if (node.gen) {
    // node is actually a generated node "div" made by another tag
    // don't process it
    return node;
  }
  const attrs = preprocessAttr(node, options.data.raw);
  const style = attrs.style || attrs._default;
  const classAttrs = attrs.class;
  if (!classAttrs?.trim()) {
    return toNode(
      "div",
      {
        style,
      },
      node.content,
    );
  }

  if (!options.data.previewing && !options.data.commonGUID) {
    // create a common GUID for the post
    // only applicable for div, style, and script tags
    // this is to prevent the same class name from being used in different posts
    options.data.commonGUID = "post-" + Math.random().toString(36).substring(2, 7);
  }
  const classSuffix = options.data.previewing ? "preview" : options.data.commonGUID;
  const classNames = classAttrs
    .split(" ")
    .map((c) => c + "__" + classSuffix)
    .join(" ");

  return toNode(
    "div",
    {
      class: classNames,
      style,
    },
    node.content,
  );
};
