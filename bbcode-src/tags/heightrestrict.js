import { preprocessAttr, toNode } from "../utils/common";

    /**
     * Parse the user provided height and return a valid height value
     * @param {Number} heightValue obtains the input of the user entered height (default is 700)
     * @returns A validated number less than 0.
     */
    function parseHeight(heightValue) {
        const maxHeight = 700;
        const parsedHeight = heightValue && heightValue.trim() !== ""
            ? heightValue.replace ( /[^\d.]/g, '' )
            : 0;
        
        if(parsedHeight && parsedHeight >= 0 && parsedHeight <= maxHeight) {
            return parsedHeight;
        } else {
            // if the value = 0 then nothing will be returned
            return parsedHeight === 0
                ? 0
                : maxHeight;
        }
    }

    /**
     * @file Adds [heightrestrict] to bbcode
     * @example [heightrestrict=50]content[/heightrestrict]
     */
    export const heightrestrict = (node) => {
        const attrs = preprocessAttr(node.attrs)._default;
        const heightInput = parseHeight(attrs).toString();
        // Return image's default size if heightrestrict did not involve a valid value
        return heightInput === "0"
            ? toNode("div", { class: "bb-height-restrict" }, node.content)
            : toNode("div", { class: "bb-height-restrict", style: `height: ${heightInput}px;` }, node.content);
    }