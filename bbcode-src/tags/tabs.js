import { isTagNode } from "@bbob/plugin-helper";
import { generateGUID, preprocessAttr, toNode, toRawTag } from "../utils/common";

/**
 * @file Adds [tabs][tab] to bbcode
 * @example [tabs][tab=name 1]content[/tab][tab=name 2]content[/tab][/tabs]
 */
export const tabs = (node, options) => {
  const tabsList = node.content.filter(
    (contentNode) => isTagNode(contentNode) && contentNode.tag === "tab"
  );
  const groupId = generateGUID();
  tabsList.forEach((tabNode) => {
    tabNode.isValid = true;
    tabNode.groupId = groupId;
  });

  if (!tabsList.length) {
    return toRawTag(node, options.data.raw);
  }

  tabsList[0].open = true;
  return toNode(
    "div",
    {
      class: "bb-tabs",
    },
    tabsList
  );
};

/**
 * [tab=name]content[/tab]
 * [tab name="name" style="style"]content[/tab]
 */
export const tab = (node, options) => {
  if (!node.isValid) {
    return toRawTag(node, options.data.raw);
  }

  const attrs = preprocessAttr(node, options.data.raw);
  const name = attrs?._default || attrs?.name || "Tab";
  const tabId = `tab-${name.replace(/\W/g, "_")}-${generateGUID()}`;
  return [
    toNode("input", {
      type: "radio",
      id: tabId,
      name: "tab-group-" + node.groupId,
      class: "bb-tab",
      checked: node.open,
    }),
    toNode(
      "label",
      {
        class: "bb-tab-label",
        for: tabId,
        style: attrs.style,
      },
      name
    ),
    toNode(
      "div",
      {
        class: "bb-tab-content",
      },
      node.content
    ),
  ];
};
