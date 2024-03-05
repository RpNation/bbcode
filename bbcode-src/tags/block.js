
import { preprocessAttr, toNode } from "../utils/common";

/**
 * 
 */
export const block = (node) => {
const blockOption = preprocessAttr(node.attrs)._default || "block";
const OPTIONS = [
    "block",
    "dice",
    "dice10",
    "setting",
    "warning",
    "storyteller",
    "announcement",
    "important",
    "question",
    "encounter",
    "information",
    "character",
    "treasure",
];

return {
    tag: "table",
    attrs: {
    class: `bb-block bb-block-${blockOption}`
    },
    content: [
    {
        tag: "tbody",
        content: [
        {
            tag: "tr",
            content: [
            {
                tag: "td",
                attrs: {
                class: "bb-block-icon"
                }
            },
            {
                tag: "td",
                attrs: {
                class: "bb-block-content"
                },
                content: node.content
            }
            ]
        }
        ]
    }
    ]
}
}