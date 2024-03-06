
import { preprocessAttr } from "../utils/common";


/**
 * Add [block] tag
 * @example [block=treasure]content[/block]
 */
export const block = (node) => {
    const block = preprocessAttr(node.attrs)._default || "block";

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

    // Default to block option if user did not provide anything valid
    const blockOption = OPTIONS.includes(block.toLowerCase()) ? block : "block";

    return {
        tag: "table",
        attrs: {
        class: "bb-block", 
        "data-bb-block": blockOption
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