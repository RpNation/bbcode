// Helpers that push markdown-it tokens on behalf of a tag spec: the state.push
// wrappers every spec (native, wrapper, or section) is built from.

import {
  CONTENT_PLACEHOLDER,
  NEWLINE_SENTINEL,
  NOBR_SENTINEL,
} from "./scanner";

// One suffix per post, shared with tags BBob renders, so [div class=x] and
// [class name=x] agree on the class name they scope.
function guidFor(state) {
  if (state.md.options.discourse?.previewing) {
    return "preview";
  }
  state.env.bbcodeGuid ||= "post-" + Math.random().toString(36).substring(2, 7);
  return state.env.bbcodeGuid;
}

// Flow content is parsed with its newlines intact, so tags nested in it (which
// may need the raw text, like [plain]) see it unchanged. Every newline in a
// flow span is a line break, so the soft breaks the parse produces (one per
// newline, including blank lines) are turned into hard breaks afterwards.
function flowText(text) {
  return text.replaceAll(NOBR_SENTINEL, " ").replaceAll(NEWLINE_SENTINEL, "\n");
}

function hardenBreaks(tokens) {
  for (const token of tokens) {
    if (token.type === "softbreak" && !token.meta?.nobr) {
      token.type = "hardbreak";
    }
  }
}

function isBlockState(state) {
  return "bMarks" in state;
}

function pushHtml(state, html, nesting = 0) {
  const block = isBlockState(state);
  const token = state.push(block ? "html_block" : "html_inline", "", nesting);
  token.content = block && html ? html + "\n" : html || "";
  return token;
}

// Runs one tag through BBob. Its per-call GUID is swapped for the post's, and
// the styles and scripts it produces are collected for the templates emitted
// once at the end of the document.
function renderWithBBob(state, slice) {
  const parser = globalThis.bbcodeParser;
  if (!parser?.RpNBBCode) {
    return null;
  }
  const result = parser.RpNBBCode(slice, {
    previewing: !!state.md.options.discourse?.previewing,
  });
  const data = result.tree.options.data;
  const guid = data.commonGUID ? guidFor(state) : null;
  const swap = (text) =>
    guid && data.commonGUID !== guid
      ? text.replaceAll(data.commonGUID, guid)
      : text;

  if (data.styles.length) {
    (state.env.bbcodeStyles ||= []).push(...data.styles.map(swap));
  }
  if (data.bbscripts.length) {
    (state.env.bbcodeScripts ||= []).push(
      ...data.bbscripts.map((script) => ({ ...script, id: swap(script.id) }))
    );
  }
  // cleans injected newlines and restores hoisted code
  return swap(
    parser.postprocess(result.html, { ...data, styles: [], bbscripts: [] })
  );
}

// The HTML BBob wraps around a tag's content, as [before, after]
function wrapperHalves(state, info) {
  const html = renderWithBBob(
    state,
    `${info.raw}${CONTENT_PLACEHOLDER}[/${info.tag}]`
  );
  const halves = html?.split(CONTENT_PLACEHOLDER);
  return halves?.length === 2 ? halves : null;
}

// HTML from an opaque tag goes through the inline parser, not into an HTML
// block, so text inside it still gets emoji and inline markdown. Newlines in
// the HTML are layout, not line breaks.
function pushOpaque(state, html) {
  if (!html) {
    return null;
  }
  if (isBlockState(state)) {
    const token = state.push("inline", "", 0);
    token.content = html;
    token.children = [];
    token.meta = { nobr: true, breakable: true };
    return token;
  }
  const tokens = [];
  state.md.inline.parse(html, state.md, state.env, tokens);
  for (const token of tokens) {
    token.level += state.level;
    token.meta = { ...token.meta, nobr: true };
  }
  state.tokens.push(...tokens);
  return null;
}

// "text" kind specs (plain, icode) push tokens via state.push(type, tag,
// nesting); at block level there is no inline state to push into yet, so this
// stands in for one, collecting the tokens spec.render() produces.
function pushText(state, spec, content) {
  const inline = state.push("inline", "", 0);
  inline.content = "";
  const children = [];
  spec.render(
    {
      push: (type, tag, nesting) => {
        const token = new state.Token(type, tag, nesting);
        children.push(token);
        return token;
      },
    },
    content
  );
  inline.children = children;
  return inline;
}

const OPAQUE = { kind: "opaque", delegate: true };

function delegateSpec(kind) {
  return {
    kind,
    delegate: true,
    open: (state, info) => pushHtml(state, info.halves[0], 1),
    close: (state, info) => pushHtml(state, info.halves[1], -1),
  };
}

function flowSpan(tag, className) {
  return {
    kind: "flow",
    open(state) {
      const token = state.push(`bbcode_${tag}_open`, "span", 1);
      if (className) {
        token.attrSet("class", className);
      }
    },
    close(state) {
      state.push(`bbcode_${tag}_close`, "span", -1);
    },
  };
}

export {
  guidFor,
  flowText,
  hardenBreaks,
  isBlockState,
  pushHtml,
  renderWithBBob,
  wrapperHalves,
  pushOpaque,
  pushText,
  OPAQUE,
  delegateSpec,
  flowSpan,
};
