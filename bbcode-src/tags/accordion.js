import {
  generateGUID,
  preprocessAttr,
  regexIndexOf,
  toNode,
  toOriginalStartTag,
} from "../utils/common";
import { TagNode, isStringNode, isTagNode } from "@bbob/plugin-helper";

const SLIDE_TITLE_OPEN = Symbol("slide-title-open");
const SLIDE_TITLE_CLOSE = Symbol("slide-title-close");
const SLIDE_CLOSE = Symbol("slide-close");
const SLIDE_REGEX =
  /(?<slideTitleOpen>\{slide=)|(?<slideTitleClose>\})|(?<slideClose>\{\/slide\})/i;

/**
 * Adds the accordion tag
 * [accordion]{slide=name}content{/slide}[/accordion]
 *
 * [accordion][slide=name]content[/slide][/accordion]
 */
const accordion = (node) => {
  const groupId = generateGUID();

  // add support for existing {slide} tags style, due to copious amounts of existing content
  // also the only way to get true custom content inside a slide due to nesting limitations
  const markedContent = generateSlideMarkersFromContent(node.content);
  const generatedSlides = generateSlidesFromMarkers(markedContent);

  const filteredContent = generatedSlides
    .filter((n) => isTagNode(n) && n.tag === "slide")
    .map((content) => {
      content.isValid = true;
      content.groupId = groupId;
      return content;
    });
  if (!filteredContent.length) {
    // no [slide] tags found
    return [toOriginalStartTag(node), ...node.content, node.toTagEnd()];
  }

  const attrs = preprocessAttr(node.attrs);

  if (attrs._default) {
    /** @type {string[]} */
    const customSettings = attrs._default.split("|");
    if (customSettings.includes("bright")) {
      attrs.bright = true;
    }
    if (customSettings.includes("bcenter")) {
      attrs.bcenter = true;
    }
    if (customSettings.includes("bleft")) {
      attrs.bleft = true;
    }
    if (customSettings.includes("fleft")) {
      attrs.fleft = true;
    }
    if (customSettings.includes("fright")) {
      attrs.fright = true;
    }
    if (
      customSettings.some((s) => s.endsWith("px")) ||
      customSettings.some((s) => s.endsWith("%"))
    ) {
      attrs.width = customSettings.find((s) => s.endsWith("px") || s.endsWith("%"));
    }
  }

  let classes = Object.keys(attrs)
    .filter((s) => ["bright", "bcenter", "bleft", "fleft", "fright"].includes(s))
    .join(" ");
  let style = "";
  if (attrs.width?.endsWith("px") || attrs.width?.endsWith("%")) {
    style = `width: ${attrs.width};`;
  }
  return toNode(
    "div",
    { class: "bb-accordion " + classes, "data-group-id": groupId, style },
    filteredContent,
  );
};

/**
 * Locates and splits all {slide} tag components into their respective parts while preserving remaining content
 * @param {(TagNode|string)[]} contentArr node content of the accordion tag
 *
 * @example
 * ```
 * ["{slide=test}", "lorem ipsum", "{/slide}"]
 * ```
 * becomes
 * ```
 * [SLIDE_TITLE_OPEN, "test", SLIDE_TITLE_CLOSE, "lorem ipsum", SLIDE_CLOSE]
 * ```
 */
function generateSlideMarkersFromContent(contentArr) {
  contentArr = [...contentArr]; // shallow clone. object nodes are not modified anyway

  const newArr = [];
  while (contentArr.length > 0) {
    const content = contentArr[0];
    if (isTagNode(content)) {
      newArr.push(contentArr.shift());
      continue;
    }
    const foundIndex = regexIndexOf(content, SLIDE_REGEX);
    if (foundIndex === -1) {
      newArr.push(contentArr.shift());
      continue;
    }
    const match = content.match(SLIDE_REGEX);
    const preContent = content.slice(0, foundIndex);
    const postContent = content.slice(foundIndex + match[0].length);
    if (preContent.length) {
      newArr.push(preContent);
    }
    if (match.groups.slideTitleOpen) {
      newArr.push(SLIDE_TITLE_OPEN);
    }
    if (match.groups.slideTitleClose) {
      newArr.push(SLIDE_TITLE_CLOSE);
    }
    if (match.groups.slideClose) {
      newArr.push(SLIDE_CLOSE);
    }
    if (postContent.length) {
      contentArr[0] = postContent;
    } else {
      contentArr.shift();
    }
  }

  return newArr;
}

/**
 * Generates slide nodes from markers
 * @param {(string | typeof SLIDE_TITLE_OPEN | typeof SLIDE_TITLE_CLOSE | typeof SLIDE_CLOSE | TagNode)[]} markedContent
 */
function generateSlidesFromMarkers(markedContent) {
  const nodes = [];
  let currentSlide = null;
  /** @type {typeof SLIDE_TITLE_OPEN | typeof SLIDE_TITLE_CLOSE | null} */
  let prevMarker = null;
  for (const content of markedContent) {
    if (content === SLIDE_TITLE_OPEN && prevMarker === null) {
      currentSlide = TagNode.create("slide");
      currentSlide.content = [];
      currentSlide.customTitle = [];
      prevMarker = SLIDE_TITLE_OPEN;
    } else if (content === SLIDE_TITLE_CLOSE && prevMarker === SLIDE_TITLE_OPEN) {
      prevMarker = SLIDE_TITLE_CLOSE;
      continue;
    } else if (content === SLIDE_CLOSE && currentSlide && prevMarker === SLIDE_TITLE_CLOSE) {
      nodes.push(currentSlide);
      currentSlide = null;
      prevMarker = null;
    } else if (currentSlide) {
      if (prevMarker === SLIDE_TITLE_OPEN) {
        currentSlide.customTitle.push(markerToString(content));
      } else {
        currentSlide.content.push(markerToString(content));
      }
    } else {
      // no slide open, just add content
      nodes.push(markerToString(content));
    }
  }
  return nodes;
}

/**
 * Processes content into a string. Catches stray markers and converts them back into a string
 * @param {string | typeof SLIDE_TITLE_OPEN | typeof SLIDE_TITLE_CLOSE | typeof SLIDE_CLOSE} marker
 * @returns expected string
 */
function markerToString(marker) {
  switch (marker) {
    case SLIDE_TITLE_OPEN:
      return "{slide=";
    case SLIDE_TITLE_CLOSE:
      return "}";
    case SLIDE_CLOSE:
      return "{/slide}";
    default:
      return marker;
  }
}

const slide = (node) => {
  if (!node.isValid) {
    // not inside an [accordion] tag
    return [toOriginalStartTag(node), ...node.content, node.toTagEnd()];
  }
  const attrs = preprocessAttr(node.attrs);
  let title = [attrs.title || attrs._default || "Slide"];
  let isOpen = !!attrs.open || false;
  let titleAlign = attrs.left ? "left" : attrs.right ? "right" : attrs.center ? "center" : "left";
  if (node.customTitle?.length) {
    // slide was created from markers
    title = node.customTitle;
    // pull out old options from title if they exist
    const possibleOptions = title
      .filter((t) => typeof t === "string")
      .join("")
      .toLowerCase()
      .split("|");
    if (possibleOptions.includes("open")) {
      isOpen = true;
    }
    if (possibleOptions.includes("right")) {
      titleAlign = "right";
    }
    if (possibleOptions.includes("center")) {
      titleAlign = "center";
    }
    if (possibleOptions.includes("left")) {
      titleAlign = "left";
    }
    title = title.map((t) => {
      if (isStringNode(t)) {
        t = t.replace(/\|(open|right|center|left)/gi, "");
      }
      return t;
    });
  }
  return [
    {
      tag: "details",
      attrs: { class: "bb-slide", open: isOpen },
      content: [
        {
          tag: "summary",
          attrs: {
            class: "bb-slide-title",
            style: `text-align: ${titleAlign}; ${attrs.style || ""}`,
          },
          content: title,
        },
        {
          tag: "div",
          attrs: { class: "bb-slide-content" },
          content: node.content,
        },
      ],
    },
  ];
};

export const accordionTags = { accordion, slide };
