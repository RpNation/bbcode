import { preprocessAttr, toNode } from "../utils/common";

/**
 * Parse the user provided height and return a valid height value
 * @param {Number} heightValue obtains the input of the user entered height (default is 700)
 * @returns A validated number less than 0.
 */
function parseHeight(heightValue) {
  const maxHeight = 700;
  const parsedHeight =
    heightValue && heightValue.trim() !== "" ? heightValue.replace(/[^\d.]/g, "") : 0;

  if (parsedHeight && parsedHeight >= 0 && parsedHeight <= maxHeight) {
    return parsedHeight;
  } else {
    // if the value = 0 then nothing will be returned
    return parsedHeight === 0 ? 0 : maxHeight;
  }
}

/**
 * @file Adds [scroll] to bbcode
 * @example [scroll]content[/scroll]
 */
export const scroll = (node, options) => {
  const attrs = preprocessAttr(node, options.data.raw)._default;
  const heightInput = parseHeight(attrs);
  return toNode("div", { class: "bb-scroll", style: `height: ${heightInput}px` }, node.content);
};
