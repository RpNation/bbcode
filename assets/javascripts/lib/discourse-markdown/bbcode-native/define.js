// How a tag is defined. Every tag is one entry in a table of definitions:
//
//   content      how the tag's content is read
//     "blocks"     markdown blocks when the tag starts its own line, one run
//                  of text when it starts mid-line
//     "auto"       one run of text, even across blank lines, unless it has
//                  markdown blocks (see needsBlocks)
//     "inline"     one run of text, always
//     "text"       a block whose content is one run of text
//     "literal"    used as written, by `render(state, content, info)`; like
//                  code, tags inside it never count when matching other tags
//     "sections"   a list of child sections (see sections.js)
//   element      (value, info, block, state) => { open, after }: the HTML
//                around the content. `open` lists elements opened before it;
//                `after`, if given, what follows it ("/" closes the innermost
//                open element), otherwise they are all closed. `block` is true
//                when the tag renders as a block.
//   open, close  (state, info) => …: push the tokens around the content
//                directly, instead of `element`
//   trimInside   no line breaks just inside the tag
//   trimAfter    the line break right after the close is dropped, as XenForo
//                does
//   lineBreaks   false: newlines inside are not line breaks
//   inlineOnly   never matched as a block, even at the start of a line
//   children     with "sections": the child tags ([tab], [slide]); closing
//                the parent also closes tags left open inside them

import { isBlockState } from "./tokens";

const el = (tag, attrs = {}) => ({ tag, attrs });
const whole = (tag, attrs = {}, text = "") => ({
  tag,
  attrs,
  whole: true,
  text,
});
const div = (attrs) => ({ open: [el("div", attrs)] });

function elementHooks(element) {
  const push = (state, { tag, attrs, whole: isWhole, text }, pending) => {
    const token = state.push(`bbcode_${tag}_open`, tag, 1);
    for (const [name, value] of Object.entries(attrs)) {
      token.attrSet(name, value ?? "");
    }
    if (isWhole) {
      if (text) {
        state.push("text", "", 0).content = text;
      }
      state.push(`bbcode_${tag}_close`, tag, -1);
    } else {
      pending.push(tag);
    }
    return token;
  };
  // open() and close() share `info`, so it's built once
  const build = (state, info) =>
    (info.element ??= element(
      info.attrs._default,
      info,
      isBlockState(state),
      state
    ));

  return {
    open(state, info) {
      const pending = [];
      return build(state, info).open.map((item) =>
        push(state, item, pending)
      )[0];
    },
    close(state, info) {
      const { open, after } = build(state, info);
      const pending = open.filter((item) => !item.whole).map(({ tag }) => tag);
      for (const item of after || pending.map(() => "/")) {
        if (item === "/") {
          const tag = pending.pop();
          state.push(`bbcode_${tag}_close`, tag, -1);
        } else {
          push(state, item, pending);
        }
      }
    },
  };
}

const noHooks = { open() {}, close() {} };

function defineTags(definitions) {
  return Object.fromEntries(
    Object.entries(definitions).map(([tag, definition]) => [
      tag,
      {
        ...(definition.element ? elementHooks(definition.element) : noHooks),
        // no HTML of its own ([nobr]), so nothing marks where it starts
        bare: !definition.element && !definition.open,
        ...definition,
      },
    ])
  );
}

export { defineTags, div, el, whole };
