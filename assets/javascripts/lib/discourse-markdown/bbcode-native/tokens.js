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
// hardenBreaks then makes each one a line break.
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

function pushHtml(state, html) {
  const token = state.push("html_block", "", 0);
  token.content = html ? html + "\n" : "";
  return token;
}

// capped, so a run of blank lines can't blow up a post
function brs(count) {
  return "<br>".repeat(Math.min(count, 20));
}

function pushBreaks(state, count) {
  if (count > 0) {
    pushHtml(state, brs(count)).meta = { br: true };
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

function parseInline(state, text) {
  const tokens = [];
  state.md.inline.parse(text, state.md, state.env, tokens);
  for (const token of tokens) {
    token.level += state.level;
  }
  return tokens;
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
  edgeNewlines,
  flowText,
  guidFor,
  hardenBreaks,
  isBlockState,
  parseInline,
  pushBreaks,
  pushHtml,
  pushText,
};
