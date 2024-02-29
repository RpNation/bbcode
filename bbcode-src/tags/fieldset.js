import { preprocessAttr, toNode } from "../utils/common";
    
/**
 * @file Adds [fieldset] to bbcode
 * @example [fieldset=title]content[/fieldset]
 */
export const fieldset = (node) => {
    const title = preprocessAttr(node.attrs)._default || "";
    return {
        tag: "fieldset",
        attrs: {
        class: "bb-fieldset",
        },
        content: [
            {
                tag: "legend",
                attrs: {
                    class: "bb-fieldset-legend"
                },
                content: title
            },
            {
                tag: "span",
                attrs: {
                    class: "bb-fieldset"
                },
                content: node.content
            }
        ]
    };
};