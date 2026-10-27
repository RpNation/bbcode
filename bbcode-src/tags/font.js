import { preprocessAttr, toNode } from "../utils/common";

const WEB_FONTS = new Map([
  ["arial", "sans-serif"],
  ["book antiqua", "serif"],
  ["courier new", "monospace"],
  ["georgia", "serif"],
  ["tahoma", "sans-serif"],
  ["times new roman", "serif"],
  ["trebuchet ms", "sans-serif"],
  ["verdana", "sans-serif"],
]);
const GOOGLE_FONT_FALLBACK = "sans-serif";
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

// every Google Fonts family name is ASCII letters, digits and spaces
const FAMILY_REGEX = /^[A-Za-z0-9][A-Za-z0-9 ]{0,63}$/;

const AXES_REGEX =
  /(?<named_weight>(?!italic)[a-zA-Z]*)?\s?(?<weight>[0-9]*)?\s?(?<italic>italic)?/;

const normalizeFamily = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const family = value.trim().replace(/\s+/g, " ");
  return FAMILY_REGEX.test(family) ? family : null;
};

const axesParser = (attrs) => {
  const axes = {
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
    if (weight && weight >= 1 && weight <= 900) {
      axes.wght = Number(weight);
    } else if (
      Object.keys(VALID_FONT_STYLES).includes(matches.named_weight || "")
    ) {
      axes.wght = Number(VALID_FONT_STYLES[matches.named_weight]);
    }
  }

  REGISTERED_AXIS.forEach((axis) => {
    if (attrs?.[axis] !== undefined) {
      axes[axis] = attrs[axis];
    }
  });

  return axes;
};

/**
 * Create google font api url
 * @param {string} family name of font
 * @param {object<string, number>} axes custom font axes
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
  const axesList =
    Object.keys(axes).join(",") + "@" + Object.values(axes).join(",");
  return "https://fonts.googleapis.com/css2?family=" + family + ":" + axesList;
};

export const font = (node, options) => {
  const attrs = preprocessAttr(node, options.data.raw);
  const family = normalizeFamily(
    attrs?._default || attrs?.family || attrs?.name
  );
  if (!family) {
    return node.content;
  }
  if (WEB_FONTS.has(family.toLowerCase())) {
    return toNode(
      "span",
      {
        style: `font-family: '${family}', ${WEB_FONTS.get(family.toLowerCase())}`,
      },
      node.content
    );
  }

  const axes = axesParser(attrs);
  const url = googleFontApiBuild(family, axes);

  const italic = Number(axes.ital) === 1 ? "italic" : "normal";

  const custom = Object.entries(axes).filter(
    ([key]) => key !== "wght" && key !== "ital"
  );
  let fontVar = "";
  if (custom.length) {
    fontVar =
      "font-variation-settings: " +
      custom.map(([key, val]) => `'${key}' ${val}`).join(", ") +
      ";";
  }

  return toNode(
    "span",
    {
      style: `font-family: '${family}', ${GOOGLE_FONT_FALLBACK}; font-weight: ${axes.wght}; font-style: ${italic}; ${fontVar}`,
      "data-font": url,
    },
    node.content
  );
};
