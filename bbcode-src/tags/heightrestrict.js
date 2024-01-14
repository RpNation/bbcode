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
    function parseImg(content, tag, heightInput) {
        if(!content) return false;
        const prepContent = Object.values(content).join("");
        const regexExpressions = {
            "[img]":                /\[img[^\]]*\](.*?)\[\/img\]/g,///\[img(.*?)\]([^\[]*)\[\/img\]/g,
            "contentWith[img]":     /(.*?)\[img(.*?)\]([^\[]*)\[\/img\](.*)/g,
            "alt":                  /\balt=/,
        };

        if(tag.toLowerCase() === "[img]") {
                let formattedContent = "";
                let imgFound = false;
                const imageUrls = [];
                while ((imgFound = regexExpressions[tag].exec(prepContent)) !== null) {
                    //const imgParts = regexExpressions[`contentWith${tag}`].exec(imgFound[0].trim());
                    const imageUrl = imgFound[1].trim();
                    //if (imageUrls.indexOf(imageUrl) === -1) 
                    imageUrls.push(imageUrl);
                    
                }

                if(imageUrls) {
                    imageUrls.forEach((match, idx) => {

                        const imgSrcParts = match.split('/');
                        const imgSrc = `<img src="${match}" alt=\"${imgSrcParts[imgSrcParts.length - 1]}\" data-zoom-target="1" loading="lazy" style="height:${heightInput}px;"/>`;

                        const finalContent = idx > 1 
                            ? formattedContent.replace(`[img]${match}[/img]`, imgSrc)
                            : prepContent.replace(`[img]${match}[/img]`, imgSrc);
                        formattedContent = finalContent;
                    });
                }
                return formattedContent === "" 
                    ? content
                    : formattedContent;
        } else {
            return prepContent;
        }
    }

    /**
     * @file Adds [heightrestrict] to bbcode
     * @example [heightrestrict=50]content[/heightrestrict]
     */
    export const heightrestrict = (node) => {
        const attrs = preprocessAttr(node.attrs)._default;
        const heightInput = parseHeight(attrs).toString();

        const parsedBody = parseImg(node.content,"[img]", heightInput);

        // return {
        //     tag: "div",
        //     attrs: {
        //         class: "bb-height-restrict",
        //         style: `height: ${input}px`
        //     },
        //     content: [
        //         {
        //             tag: "div",
        //             attrs: {
        //                 class: "img",
        //                 style: "cursor:pointer;"
        //             },
        //             content: parsedBody,
        //         },
        //     ]
                
        // };
        
        return toNode("div", { class: "bb-height-restrict", style: `--data-type: ${heightInput}px`  }, parsedBody);        //return toNode("div", { class: "div.bb-img-wrapper", style: `height: ${input}px` }, node.content);
    }