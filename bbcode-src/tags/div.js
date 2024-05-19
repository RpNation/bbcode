import { preprocessAttr, toNode } from "../utils/common";

/**
 * Adds [div] tag
 * [div=css]Content[/div]
 * [div class="class" style="css"]Content[/div]
 */
export const div = (node, options) => {
  const attrs = preprocessAttr(node.attrs);
  const style = attrs.style || attrs._default;
  const classAttrs = attrs.class;

  if (!classAttrs?.trim()) {
    return toNode(
      "div",
      {
        style,
      },
      node.content
    );
  }

  let classSuffix = options.data.previewing ? "-preview" : "";
  const classNames = classAttrs.split(" ").map((c) => c + classSuffix);

  return toNode(
    "div",
    {
      class: classNames,
      style,
    },
    node.content
  );
};
