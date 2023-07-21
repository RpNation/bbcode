/**
 * Disables line breaks for given content
 * @example
 * ```
 * [nobr]test
 * test
 * test
 * [/nobr]
 *
 * test test test
 * ```
 */
export const nobr = (node) => {
  return { disableLineBreakConversion: true, content: node.content };
};
