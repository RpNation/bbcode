import { preprocessAttr, toNode } from "../utils/common";

const WEB_FONTS = [
  "arial",
  "book antiqua",
  "courier new",
  "georgia",
  "tahoma",
  "times new roman",
  "trebuchet ms",
  "verdana",
];
const VALID_FONT_STYLES = {
  thin: "100",
  extralight: "200",
  light: "300",
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
  black: "900",
};
// registered axis tags https://learn.microsoft.com/en-us/typography/opentype/spec/dvaraxisreg#registered-axis-tags
const REGISTERED_AXIS = ["ital", "opsz", "slnt", "wdth", "wght"];

const AXES_REGEX = /(?<named_weight>[a-zA-Z]*)?\s?(?<weight>[0-9]*)?\s?(?<italic>italic)?/;

const axesParser = (attrs) => {
  let axes = {
    ital: 0,
    wght: 400,
  };

  if (attrs?.style) {
    // user just copy pasted the name of the style on the google font site, probably
    const style = attrs.style.trim().toLowerCase();
    const matches = AXES_REGEX.exec(style).groups || {};
    if (matches?.italic) {
      axes.ital = 1;
    }

    const weight = matches.weight;
    if (weight && weight >= 0 && weight <= 900) {
      axes.wght = weight;
    } else if (Object.keys(VALID_FONT_STYLES).includes(matches.named_weight || "")) {
      axes.wght = VALID_FONT_STYLES[matches.named_weight];
    }

    axes = {
      ...axes,
      ...Object.fromEntries(Object.entries(attrs).filter(([key]) => REGISTERED_AXIS.includes(key))),
    };
  }
  return axes;
};

/**
 * Create google font api url
 * @param {string} family name of font
 * @param {object<string, string>} axes custom font axes
 */
const googleFontApiBuild = (family, axes) => {
  family = family.replaceAll(" ", "+");
  // google fonts requires axes names to be in alphabetical order
  axes = Object.keys(axes)
    .sort()
    .reduce((obj, key) => {
      obj[key] = axes[key];
      return obj;
    }, {});
  const axesList = Object.keys(axes).join(",") + "@" + Object.values(axes).join(",");
  return "https://fonts.googleapis.com/css2?family=" + family + ":" + axesList;
};

export const font = (node, options) => {
  const attrs = preprocessAttr(node.attrs);
  const fontFamily = attrs?._default || attrs.family || attrs.name;
  if (fontFamily.trim() === "") {
    return node.content;
  }
  if (WEB_FONTS.includes(fontFamily.trim().toLowerCase())) {
    return toNode("span", { style: "font-family: " + fontFamily }, node.content);
  }

  const axes = axesParser(attrs);
  const url = googleFontApiBuild(fontFamily, axes);
  options.data.fonts.add(url);

  const italic = axes.ital === 1 ? "italic" : "normal";

  const custom = Object.entries(axes).filter(([key]) => key !== "wght" && key !== "ital");
  let fontVar = "";
  if (custom.length) {
    fontVar =
      "font-variation-settings: " + custom.map(([key, val]) => `'${key}' ${val}`).join(", ") + ";";
  }

  return toNode(
    "span",
    {
      style: `font-family: ${fontFamily}; font-weight: ${axes.wght}; font-style: ${italic}; ${fontVar}`,
      "data-font": url,
    },
    node.content,
  );
};
