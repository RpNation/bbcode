/**
 * [plain] bbcode tag that prevents parsing of inner tags
 * @example
 * ```
 * [plain]This is [b]bold[/b] and [i]italic[/i][/plain]
 * ```
 * outputs to
 * ```
 * This is [b]bold[/b] and [i]italic[/i]
 * ```
 */
export const plain = (node) => {
  return node.content;
};
