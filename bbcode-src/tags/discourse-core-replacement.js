/**
 * @file discourse-core-replacement.js
 * This is a dedicated file for replacing the standard Discourse BBCode tags in core.
 * In the markdown-it engine, discourse has added these bbcode tags in the inline parser.
 * However this means that if the parser detects a block level tag inside an inline tag,
 * it will not parse the inline tag.
 *
 * This file is meant to fix such scenarios by doing the parsing of bbcode tags for it.
 *
 * @example
 * [b][h]bold[/h][/b]   // this should properly parse the bold tag inside the h tag
 *
 * https://github.com/discourse/discourse/blob/d7ece61252d7671a1f124483836279b99852c08c/app/assets/javascripts/discourse-markdown-it/src/features/bbcode-inline.js
 */
import { toNode } from "../utils/common";

export const bold = (node) => {
  return toNode("span", { class: "bbcode-b" }, node.content);
};

export const italic = (node) => {
  return toNode("span", { class: "bbcode-i" }, node.content);
};

export const underline = (node) => {
  return toNode("span", { class: "bbcode-u" }, node.content);
};

export const strike = (node) => {
  return toNode("span", { class: "bbcode-s" }, node.content);
};
