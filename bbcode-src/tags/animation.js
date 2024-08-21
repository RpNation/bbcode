import { isStringNode, isTagNode } from "@bbob/plugin-helper";
import { preprocessAttr, toOriginalEndTag, toOriginalStartTag } from "../utils/common";

/**
 * Renders css Keyframes
 *
 * [animation=name][keyframe=0]color: red[/keyframe][/animation]
 */
export const animation = (node, options) => {
  if (!options.data.previewing && !options.data.commonGUID) {
    // create a common GUID for the post
    // only applicable for div, style, and script tags
    // this is to prevent the same class name from being used in different posts
    options.data.commonGUID = "post-" + Math.random().toString(36).substring(2, 7);
  }
  const commonId = options.data.previewing ? "preview" : options.data.commonGUID;

  const name = preprocessAttr(node, options.data.raw)?._default || "";
  const keyframes = node.content
    .filter((n) => isTagNode(n) && n.tag === "keyframe")
    .map((content) => {
      content.isValid = true;
      /** @type {string} */
      const ident = preprocessAttr(content, options.data.raw)._default || "";
      content.ident = ident + (ident.match(/^\d+$/) ? "%" : "");
      const cleanContent = content.content
        .filter(isStringNode)
        .join("")
        .replaceAll(/[\[\]\{\}]/g, "");
      content.formatted = `${content.ident}{ ${cleanContent} }`;
      return content;
    });
  const keyframeContent = keyframes.map((n) => n.formatted).join("\n");
  const content = `@keyframes ${commonId}${name} { ${keyframeContent} }`;
  options.data.styles.push(content);
  return [];
};

export const keyframe = (node, options) => {
  if (!node.isValid) {
    return [
      toOriginalStartTag(node, options.data.raw),
      ...node.content,
      toOriginalEndTag(node, options.data.raw),
    ];
  }
  return [];
};
