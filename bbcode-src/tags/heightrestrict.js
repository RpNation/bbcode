import { preprocessAttr, toNode } from "../utils/common";

   /**
     * Parse the user provided height and return a valid height value
     * @param {String} heightValue obtains the input of the user entered height (default is 700)
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
     * Prase out specific attributes to prevent them from passing and formatting into strings (i.e. [img])
     * @param {*} content obtains the user input
     * @param {*} tag obtains the attribute tag that requires extracting and formatting
     * @returns Formatting string
     */
   function parseImg(content, heightInput) {
    if(!content) return content;
    const prepContent = Object.values(content).join("");
    const imgRegex = /\[img[^\]]*\](.*?)\[\/img\]/g ;

    let formattedContent = "";
    let imgFound = false;
    const imageUrls = [];

    // In the event there are multiple images, capture them
    while ((imgFound = imgRegex.exec(prepContent)) !== null) {
        const imageUrl = imgFound[1].trim();
        imageUrls.push(imageUrl);
    }

    if(imageUrls.length > 0) {
        imageUrls.forEach((match, idx) => {
            const imgSrcParts = match.split('/');
            const imgHTML = `<img src="${match}" alt="${imgSrcParts[imgSrcParts.length - 1]}" data-zoom-target="1" loading="lazy" style="height:${heightInput}px;"/>`;

            // If index exceeds 0, we are restricting multiple image heights
            const finalContent = idx > 0
                ? formattedContent.replace(`[img]${match}[/img]`, imgHTML)
                : prepContent.replace(`[img]${match}[/img]`, imgHTML);

            formattedContent = finalContent;
        });
    }

    return formattedContent === "" 
        ? content
        : formattedContent;
}

    /**
     * @file Adds [heightrestrict] to bbcode
     * @example [heightrestrict=50]content[/heightrestrict]
     */
    export const heightrestrict = (node) => {
        const attrs = preprocessAttr(node.attrs)._default;
        const heightInput = parseHeight(attrs).toString();
        const parsedBody = parseImg(node.content, heightInput);

        return toNode("div", { class: "bb-height-restrict", style: `height: ${heightInput}px;`  }, parsedBody);        //return toNode("div", { class: "div.bb-img-wrapper", style: `height: ${input}px` }, node.content);
    }