import { preprocessAttr, toNode } from "../utils/common";

/**
 * Parse the user provided height and return a valid height value
 * @param {String} heightValue obtains the input of the user entered height
 */
function parseHeight(heightValue) {
    const maxHeight = 700;
    const parsedHeight = heightValue && heightValue.trim() !== ""
        ? heightValue.replace ( /[^\d.]/g, '' )
        : 0;
    if(parsedHeight && parsedHeight > 0 && parsedHeight < maxHeight) {
        return parsedHeight;
    } else {
        return maxHeight;
    }
}

/**
 * @file Adds [heightrestrict] to bbcode
 * @example [heightrestrict]content[/heightrestrict]
 */
export const heightrestrict = (node) => {
    const attrs = preprocessAttr(node.attrs)._default;
    const input = parseHeight(attrs).toString();

    return {
        tag: "div",
        attrs: {
            class: "bb-img-wrapper",
        },
        content: [
            {
                tag: "div",
                attrs: {
                    class: "bb-height-restrict",
                    style: `height: ${input}px`
                },
                content: node.content,
            },
        ],
    };
}
