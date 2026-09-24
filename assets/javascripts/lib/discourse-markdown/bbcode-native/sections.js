// Tags whose body is a list of sections: [tabs]/[tab] and [accordion]/[slide].

import { defineTags } from "./define";
import {
  coverEnd,
  findClose,
  isEscaped,
  literalRanges,
  parseLooseTag,
  PHANTOM,
} from "./scanner";
import { guidFor, isBlockState, parseInline, pushTokens } from "./tokens";

// the close of the known tag opening at `index`
function closeOf(text, index, isKnown) {
  const info =
    !isEscaped(text, index) && parseLooseTag(text, index, isKnown, true);
  return (
    info &&
    !info.closing &&
    findClose(text, index + info.length, info.tag, isKnown)
  );
}

// top level only: what's nested in another tag, a code span or a literal
// tag is not a section boundary
function findTop(content, from, pattern, isKnown) {
  const literal = literalRanges(content);
  let index = from;
  while (index < content.length) {
    const literalEnd = coverEnd(literal, index);
    if (literalEnd !== -1) {
      index = literalEnd;
      continue;
    }
    pattern.lastIndex = index;
    const match = pattern.exec(content);
    if (match) {
      return { index, text: match[0] };
    }
    const close = content[index] === "[" && closeOf(content, index, isKnown);
    index = close ? close.end : index + 1;
  }
  return null;
}

function topLevelText(text, isKnown) {
  let out = "";
  let index = 0;
  while (index < text.length) {
    const close = text[index] === "[" && closeOf(text, index, isKnown);
    if (close) {
      index = close.end;
    } else {
      out += text[index++];
    }
  }
  return out;
}

// the flatten pass's newline before a mid-line block isn't a line break
const withoutLeadingPhantom = (text) =>
  text.startsWith(PHANTOM + "\n") ? text.slice(2) : text;

function bracketSection(content, hit, isKnown) {
  const info = parseLooseTag(content, hit.index, isKnown);
  const close =
    info && findClose(content, hit.index + info.length, info.tag, isKnown);
  if (!close) {
    return null;
  }
  return {
    info,
    body: withoutLeadingPhantom(
      content.slice(hit.index + info.length, close.start)
    ),
    end: close.end,
  };
}

function tabSections(content, isKnown) {
  const known = (tag) => tag === "tab" || isKnown(tag);
  const sections = [];
  let index = 0;
  let hit;
  while ((hit = findTop(content, index, /\[tab(?=[\]=\s])/iy, known))) {
    const found = bracketSection(content, hit, known);
    if (!found) {
      index = hit.index + 1;
      continue;
    }
    const attrs = found.info.attrs;
    sections.push({
      name: attrs._default || attrs.name || "Tab",
      style: attrs.style,
      body: found.body,
    });
    index = found.end;
  }
  return sections;
}

const SLIDE_OPTION_RE = /\|(open|right|center|left)/gi;

// Both [slide=Title]…[/slide] and the older {slide=Title|open}…{/slide}
function slideSections(content, isKnown) {
  const known = (tag) => tag === "slide" || isKnown(tag);
  const sections = [];
  let index = 0;
  let hit;
  while (
    (hit = findTop(content, index, /\{slide=|\[slide(?=[\]=\s])/iy, known))
  ) {
    if (hit.text[0] === "[") {
      const found = bracketSection(content, hit, known);
      if (!found) {
        index = hit.index + 1;
        continue;
      }
      const attrs = found.info.attrs;
      sections.push({
        title: attrs.title || attrs._default || "Slide",
        open: !!attrs.open,
        align: attrs.left
          ? "left"
          : attrs.right
            ? "right"
            : attrs.center
              ? "center"
              : "left",
        style: attrs.style || "",
        body: found.body,
      });
      index = found.end;
      continue;
    }

    const titleFrom = hit.index + hit.text.length;
    const titleEnd = findTop(content, titleFrom, /\}/y, known);
    const bodyEnd =
      titleEnd && findTop(content, titleEnd.index + 1, /\{\/slide\}/iy, known);
    if (!bodyEnd) {
      index = hit.index + 1;
      continue;
    }
    const title = withoutLeadingPhantom(
      content.slice(titleFrom, titleEnd.index)
    );
    const options = topLevelText(title, known)
      .toLowerCase()
      .split("|")
      .map((option) => option.trim());
    let align = "left";
    for (const side of ["right", "center", "left"]) {
      if (options.includes(side)) {
        align = side;
      }
    }
    sections.push({
      title: title.replace(SLIDE_OPTION_RE, ""),
      open: options.includes("open"),
      align,
      style: "",
      body: withoutLeadingPhantom(
        content.slice(titleEnd.index + 1, bodyEnd.index)
      ),
    });
    index = bodyEnd.index + bodyEnd.text.length;
  }
  return sections;
}

// the post suffix keeps ids unique across a topic and stable across rebakes
function nextGroupId(state) {
  state.env.bbcodeGroups = (state.env.bbcodeGroups || 0) + 1;
  return `${guidFor(state)}-${state.env.bbcodeGroups}`;
}

function pushInlineContent(state, text) {
  if (isBlockState(state)) {
    const token = state.push("inline", "", 0);
    token.content = text.trimStart();
    token.children = [];
    return;
  }
  pushTokens(state, parseInline(state, text));
}

const ACCORDION_ALIGNMENTS = ["bright", "bcenter", "bleft", "fleft", "fright"];

const SECTION_TAGS = defineTags({
  tabs: {
    content: "sections",
    children: ["tab"],
    sections: tabSections,
    open(state, info) {
      info.group = nextGroupId(state);
      info.tabs = 0;
      const token = state.push("bbcode_tabs_open", "div", 1);
      token.attrSet("class", "bb-tabs");
      return token;
    },
    close(state) {
      state.push("bbcode_tabs_close", "div", -1);
    },
    sectionOpen(state, section, index, info) {
      const id = `tab-${section.name.replace(/\W/g, "_")}-${info.group}-${index}`;
      const input = state.push("bbcode_tab_input", "input", 0);
      input.attrSet("type", "radio");
      input.attrSet("id", id);
      input.attrSet("name", `tab-group-${info.group}`);
      input.attrSet("class", "bb-tab");
      if (index === 0) {
        input.attrSet("checked", "");
      }
      const label = state.push("bbcode_tab_label_open", "label", 1);
      label.attrSet("class", "bb-tab-label");
      label.attrSet("for", id);
      if (section.style) {
        label.attrSet("style", section.style);
      }
      state.push("text", "", 0).content = section.name;
      state.push("bbcode_tab_label_close", "label", -1);
      state
        .push("bbcode_tab_content_open", "div", 1)
        .attrSet("class", "bb-tab-content");
    },
    sectionClose(state) {
      state.push("bbcode_tab_content_close", "div", -1);
    },
  },

  accordion: {
    content: "sections",
    children: ["slide"],
    sections: slideSections,
    open(state, info) {
      const attrs = info.attrs;
      const settings = (attrs._default || "").split("|").map((s) => s.trim());
      const align =
        attrs.align ||
        settings.filter((s) => ACCORDION_ALIGNMENTS.includes(s)).pop() ||
        "";
      const width =
        attrs.width ||
        settings.find((s) => s.endsWith("px") || s.endsWith("%"));
      const token = state.push("bbcode_accordion_open", "div", 1);
      token.attrSet("class", `bb-accordion ${align.toLowerCase()}`.trim());
      token.attrSet("data-group-id", nextGroupId(state));
      token.attrSet(
        "style",
        width?.endsWith("px") || width?.endsWith("%") ? `width: ${width};` : ""
      );
      return token;
    },
    close(state) {
      state.push("bbcode_accordion_close", "div", -1);
    },
    sectionOpen(state, section) {
      const details = state.push("bbcode_slide_open", "details", 1);
      details.attrSet("class", "bb-slide");
      if (section.open) {
        details.attrSet("open", "");
      }
      const summary = state.push("bbcode_slide_title_open", "summary", 1);
      summary.attrSet("class", "bb-slide-title");
      summary.attrSet(
        "style",
        `text-align: ${section.align}; ${section.style}`
      );
      pushInlineContent(state, section.title);
      state.push("bbcode_slide_title_close", "summary", -1);
      state
        .push("bbcode_slide_content_open", "div", 1)
        .attrSet("class", "bb-slide-content");
    },
    sectionClose(state) {
      state.push("bbcode_slide_content_close", "div", -1);
      state.push("bbcode_slide_close", "details", -1);
    },
  },
});

export { SECTION_TAGS };
