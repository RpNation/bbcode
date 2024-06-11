import { preprocessAttr } from "../utils/common";

const EVENTS = [
  "init",
  "click",
  "change",
  "input",
  "dblclick",
  "mouseenter",
  "mouseleave",
  "scroll",
];

/**
 * Script tag
 *
 * [script]content[/script]
 *
 * [script class="id" on="event" version="2"]content[/script]
 */
export const script = (node, options) => {
  const attrs = preprocessAttr(node.attrs);

  if (!options.data.previewing && !options.data.commonGUID) {
    // create a common GUID for the post
    // only applicable for div, style, and script tags
    // this is to prevent the same class name from being used in different posts
    options.data.commonGUID = "post-" + Math.random().toString(36).substring(2, 7);
  }
  const classSuffix = options.data.previewing ? "preview" : options.data.commonGUID;

  const onEvent =
    (EVENTS.includes(attrs.on?.toLowerCase() || "init") && attrs.on?.toLowerCase()) || "init";

  const scriptSetup = {
    id: classSuffix,
    class: attrs.class || "",
    on: onEvent,
    version: attrs.version || "",
    content: node.content.join(""),
  };
  options.data.bbscripts.push(scriptSetup);

  return [];
};
