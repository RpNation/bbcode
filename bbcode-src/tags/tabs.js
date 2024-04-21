import { generateGUID, preprocessAttr, toNode, toOriginalStartTag } from "../utils/common";
import { isTagNode } from "@bbob/plugin-helper";

/**
 * @file Adds [tabs][tab] to bbcode
 * @example [tabs][tab=name 1]content[/tab][tab=name 2]content[/tab][/tabs]
 */
export const tabs = (node) => {
  const tabsList = node.content.filter(
    (contentNode) => isTagNode(contentNode) && contentNode.tag === "tab",
  );
  const groupId = generateGUID();
  tabsList.forEach((tabNode) => {
    tabNode.isValid = true;
    tabNode.groupId = groupId;
  });
  if (!tabsList.length) {
    // no [tab] tags found
    return [toOriginalStartTag(node), ...node.content, node.toTagEnd()];
  }
  tabsList[0].open = true;

  return toNode(
    "div",
    {
      class: "bb-tabs",
    },
    tabsList,
  );
};

export const tab = (node) => {
  if (!node.isValid) {
    // not inside a [tabs] tag
    return [toOriginalStartTag(node), ...node.content, node.toTagEnd()];
  }
  const attrs = preprocessAttr(node.attrs);
  const name = attrs._default || attrs.name || "Tab";
  return [
    toNode("input", {
      type: "radio",
      id: `tab-${name.replace(/\W/g, "_")}-${node.groupId}`,
      name: "tab-group-" + node.groupId,
      class: "bb-tab",
      checked: node.open,
    }),
    toNode(
      "label",
      {
        class: "bb-tab-label",
        for: `tab-${name.replace(/\W/g, "_")}-${node.groupId}`,
      },
      name,
    ),
    toNode(
      "div",
      {
        class: "bb-tab-content",
      },
      node.content,
    ),
  ];
};
