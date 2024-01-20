import { toNode } from "../utils/common";

    /**
     * @file Adds [img] to bbcode
     * @example [img]imgURL[/img]
     */
    export const img = (node) => {
        const imgContent = Object.values(node.content).join("");
        const imgSrcParts = imgContent.split('/');
        const imgHTML = `<img src="${imgContent}" alt="${imgSrcParts[imgSrcParts.length - 1]}" data-zoom-target="1" loading="lazy"/>`;
        return toNode("div", { class: "bb-img" }, imgHTML);
    }