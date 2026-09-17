import { createLexer, createTokenOfType } from "@bbob/parser/lexer";
import { TYPE_TAG, TYPE_WORD } from "@bbob/parser/Token";

// BBob 4.2 only flushes one unclosed node at EOF and blindly pops a node for
// any closing tag. Long, historically valid XenForo layouts can therefore
// disappear entirely. Use its tokenizer extension to close missing children
// before their ancestor, and finish every remaining wrapper at EOF.
export function createLegacyTokenizer(input, options) {
  const pending = [];
  const onToken = options.onToken;
  const close = (name, position) => {
    onToken(createTokenOfType(TYPE_TAG, `/${name}`, 0, 0, position, position));
  };

  const lexer = createLexer(input, {
    ...options,
    onToken(token) {
      if (token.isTag() && token.isStart()) {
        const name = token.getValue().toLowerCase();
        if (lexer.isTokenNested(name)) {
          pending.push(name);
        }
      } else if (token.isTag() && token.isEnd()) {
        const name = token.getValue().slice(1).toLowerCase();
        const matching = pending.lastIndexOf(name);
        if (matching === -1) {
          // An extra closing tag is text; it must not close an unrelated node.
          onToken(createTokenOfType(TYPE_WORD, token.toString()));
          return;
        }
        while (pending.length - 1 > matching) {
          close(pending.pop(), token.getStart());
        }
        pending.pop();
      }
      onToken(token);
    },
  });

  const tokenize = lexer.tokenize;
  lexer.tokenize = () => {
    const tokens = tokenize();
    while (pending.length) {
      close(pending.pop(), input.length);
    }
    return tokens;
  };
  return lexer;
}
