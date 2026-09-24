import { NEWLINE_SENTINEL, NOBR_SENTINEL } from "./scanner";

// one per post, so [div class=x] and [class name=x] scope the same class
function guidFor(state) {
  if (state.md.options.discourse?.previewing) {
    return "preview";
  }
  state.env.bbcodeGuid ||= "post-" + Math.random().toString(36).substring(2, 7);
  return state.env.bbcodeGuid;
}

// Newlines are kept, so nested tags such as [plain] see the text unchanged;
// each becomes a softbreak, which renders as a line break.
function flowText(text) {
  return text
    .replaceAll(NOBR_SENTINEL, "\n")
    .replaceAll(NEWLINE_SENTINEL, "\n");
}

function isBlockState(state) {
  return "bMarks" in state;
}

function pushHtml(state, html) {
  const token = state.push("html_block", "", 0);
  token.content = html ? html + "\n" : "";
  return token;
}

// capped, so a run of blank lines can't blow up a post
function brs(count) {
  return "<br>".repeat(Math.min(count, 20));
}

// inside [nobr] they stay newlines
function pushBreaks(state, count) {
  if (count > 0) {
    state.push("html_block", "", 0).content = state.env.bbcodeNoBreaks
      ? "\n".repeat(count)
      : brs(count) + "\n";
  }
}

// [newlines in the leading whitespace, newlines in the trailing whitespace]
function edgeNewlines(text) {
  const count = (edge) => edge.split("\n").length - 1;
  const trimmed = text.trim();
  if (!trimmed) {
    return [count(text), 0];
  }
  return [
    count(text.slice(0, text.length - text.trimStart().length)),
    count(text.slice(text.trimEnd().length)),
  ];
}

// Each level of tags is a nested parse, and the stack runs out after about a
// thousand, so deeper tags stay text.
const MAX_DEPTH = 100;

function depthOf(state) {
  return state.env.bbcodeDepth ?? 0;
}

function tooDeep(state) {
  return depthOf(state) >= MAX_DEPTH;
}

// inline content is parsed after all the blocks it sits in, at this depth
function setDepth(inline, depth) {
  if (inline.meta?.bbcodeDepth === undefined) {
    inline.meta = { ...inline.meta, bbcodeDepth: depth };
  }
}

function parseAt(state, depth, parse) {
  const tokens = [];
  const outer = state.env.bbcodeDepth;
  state.env.bbcodeDepth = depth;
  parse(tokens);
  state.env.bbcodeDepth = outer;
  for (const token of tokens) {
    token.level += state.level;
  }
  return tokens;
}

// not push(...tokens): a long list is more arguments than a call can take
function pushTokens(state, tokens) {
  for (const token of tokens) {
    state.tokens.push(token);
  }
}

function parseInline(state, text) {
  return parseAt(state, depthOf(state) + 1, (tokens) =>
    state.md.inline.parse(text, state.md, state.env, tokens)
  );
}

// A literal tag's render() pushes inline tokens; at block level this stands in
// for the inline state it expects.
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

export {
  brs,
  depthOf,
  edgeNewlines,
  flowText,
  guidFor,
  isBlockState,
  MAX_DEPTH,
  parseAt,
  parseInline,
  pushBreaks,
  pushHtml,
  pushText,
  pushTokens,
  setDepth,
  tooDeep,
};
