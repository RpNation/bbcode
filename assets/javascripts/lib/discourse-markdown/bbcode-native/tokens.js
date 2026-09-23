// Helpers that push markdown-it tokens on behalf of a tag spec: the state.push
// wrappers every spec (native, wrapper, or section) is built from.

import { NEWLINE_SENTINEL, NOBR_SENTINEL } from "./scanner";

// One suffix per post, so [div class=x] and [class name=x] agree on the class
// name they scope.
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

// "literal" tags (plain, icode, fa, ...) push tokens via state.push(type, tag,
// nesting); at block level there is no inline state to push into yet, so this
// stands in for one, collecting the tokens their render() produces.
function pushText(state, spec, content, info) {
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
      env: state.env,
      md: state.md,
    },
    content,
    info
  );
  inline.children = children;
  return inline;
}

export { guidFor, flowText, hardenBreaks, isBlockState, pushHtml, pushText };
