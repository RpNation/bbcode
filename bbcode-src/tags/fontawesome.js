import { preprocessAttr, toNode } from "../utils/common";

/**
 * Adds [fa] tag
 * [fa]fa-icon[/fa]
 * [fa style="" fa-transform=""]fa-solid fa-icon[/fa]
 * [fa primary-color="" secondary-color="" primary-opacity="" secondary-opacity="" rotate-angle=""]fa-duotone fa-icon[/fa]
 */
export const fa = (node) => {
  const attrs = preprocessAttr(node.attrs);
  let style = attrs.style || "";
  style += attrs["primary-color"] ? `--fa-primary-color: ${attrs["primary-color"]};` : "";
  style += attrs["secondary-color"] ? `--fa-secondary-color: ${attrs["secondary-color"]};` : "";
  style += attrs["primary-opacity"] ? `--fa-primary-opacity: ${attrs["primary-opacity"]};` : "";
  style += attrs["secondary-opacity"]
    ? `--fa-secondary-opacity: ${attrs["secondary-opacity"]};`
    : "";
  style += attrs["rotate-angle"] ? `--fa-rotate-angle: ${attrs["rotate-angle"]};` : "";

  return toNode(
    "i",
    {
      "data-bbcode-fa": null,
    },
    [
      toNode(
        "i",
        {
          class: (node.content || []).join(""),
          style,
          "data-fa-transform": attrs["fa-transform"] || "",
        },
        [],
      ),
    ],
  );
};
