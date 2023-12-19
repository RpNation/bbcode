import { preprocessAttr, toNode } from "../utils/common";

/**
 * Parses an inputted size value and returns the formatted valid font size
 * @param {string} fontValue the input of the size
 */
function parseFontSize(fontValue) {
  let value;
  let fontSize = { valid: true };
  const parsedSize = /(\d+\.?\d?)(px|rem)?/i.exec(fontValue);
  const sizeRanges = {
    px_max: 36,
    px_min: 8,
    rem_max: 3,
    rem_min: 0.2,
    unitless_max: 7,
    unitless_min: 1,
  };

  if (parsedSize && (value = parsedSize[1])) {
    fontSize.unit = (parsedSize[2] || "").toLowerCase();
    switch (fontSize.unit) {
      case "px":
        if (value > sizeRanges.px_max) {
          value = sizeRanges.px_max;
        } else if (value < sizeRanges.px_min) {
          value = sizeRanges.px_min;
        }
        break;
      case "rem":
        if (value > sizeRanges.rem_max) {
          value = sizeRanges.rem_max;
        } else if (value < sizeRanges.rem_min) {
          value = sizeRanges.rem_min;
        }
        break;
      default:
        if ((fontSize.valid = fontValue.length === value.length)) {
          if (value > sizeRanges.unitless_max) {
            value = sizeRanges.unitless_max;
          } else if (value < sizeRanges.unitless_min) {
            value = sizeRanges.unitless_min;
          }
        }
        break;
    }

    fontSize.value = value;
  }
  return fontSize;
}

export const size = (node) => {
  const input = preprocessAttr(node.attrs)._default;
  const fontSize = parseFontSize(input);
  if (!fontSize.valid) {
    return node.content;
  }
  let outputAttr = {};
  if (fontSize.unit) {
    outputAttr = { style: `font-size: ${fontSize.value}${fontSize.unit}` };
  } else {
    outputAttr = { "data-size": fontSize.value };
  }
  return toNode("span", outputAttr, node.content);
};
