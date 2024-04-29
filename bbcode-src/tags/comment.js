import { toNode } from "../utils/common";

/**
 * @file Adds [comment] tag
 * @example [comment]Content[/comment]
 */

const comment = (node) => {
    return toNode(
        "div", {style: "display: none;", class: "bb-hidden",}, node.content,
    );
};

export { comment };