import { preprocessAttr, toNode } from "../utils/common";

const maxHeight = 700;

/**
 * Parse the user provided height and return a valid height value
 * @param {String} heightValue obtains the input of the user entered height
 */
function parseHeight(heightValue) {
    const parsedHeight = heightValue.replace ( /[^\d.]/g, '' );
    if(parsedHeight && parsedHeight > 0 && parsedHeight < maxHeight) {
        return parsedHeight;
    } else {
        return false;
    }
}

/**
 * @file Adds [heightrestrict] to bbcode
 * @example [heightrestrict]content[/heightrestrict]
 */
export const heightrestrict = (node) => {
  const attrs = preprocessAttr(node.attrs)._default;
  const input = parseHeight(attrs);
  console.warn("1",attrs, input);
  if(input) {
    return toNode("span", { style: `height: ${input}px` }, node.content);
  } else {
    return toNode("span", { style: `height: ${maxHeight}px` }, node.content);
  }
};
