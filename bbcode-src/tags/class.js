import { isStringNode } from "@bbob/plugin-helper";
import { preprocessAttr } from "../utils/common";

/**
 * Class style tag
 *
 * [class=name]content[/class]
 * [class name="className" state="psuedo-class" minWidth="" maxWidth=""]content[/class]
 * [class name="className" selector=""]content[/class]
 */
export const classStyle = (node, options) => {
  const attrs = preprocessAttr(node.attrs);
  const nameAttr = attrs.name || attrs._default;

  if (!options.data.previewing && !options.data.commonGUID) {
    // create a common GUID for the post
    // only applicable for div, style, and script tags
    // this is to prevent the same class name from being used in different posts
    options.data.commonGUID = "post-" + Math.random().toString(36).substring(2, 7);
  }
  const classSuffix = options.data.previewing ? "preview" : options.data.commonGUID;
  const className = nameAttr + "__" + classSuffix;
  const content = node.content
    .filter(isStringNode)
    .map((s) => s.replaceAll("{post_id}", classSuffix).replaceAll(/[\[\]\{\}]/g, ""));
  let selector = "";
  const mediaQuery = [];
  if (
    ["hover", "focus", "active", "focus-within", "focus-visible"].includes(
      attrs.state?.toLowerCase(),
    )
  ) {
    selector = ":" + attrs.state.toLowerCase();
  }
  if (attrs.selector) {
    selector = attrs.selector.replace(/[,{}\\\n]/g, "");
  }
  if (attrs.minWidth?.match(/^[0-9]+[a-z]+$/)) {
    // @media (min-width: )
    mediaQuery.push(`(min-width: ${attrs.minWidth})`);
  }
  if (attrs.maxWidth?.match(/^[0-9]+[a-z]+$/)) {
    // @media (max-width: )
    mediaQuery.push(`(max-width: ${attrs.maxWidth})`);
  }

  content.unshift(`.${className}${selector} {`);
  content.push("}");
  if (mediaQuery.length) {
    content.unshift(`@media ${mediaQuery.join(" and ")} {`);
    content.push("}");
  }
  options.data.styles.push(content.join(""));

  return [];
};
