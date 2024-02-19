import { ESCAPABLES_REGEX, regexIndexOf } from "./common";

/**
 * Find all code blocks and hoist them out of the content and into a map for later insertion
 * @param {string} raw input to preprocess
 * @returns processed string and hoist map
 */
function fenceCodeBlockPreprocess(content, data) {
  /** @type {Object.<string, string>} */
  const hoistMap = {};
  let index = 0;

  const addHoistAndReturnNewStartPoint = (cutOffStart, cutOffEnd, expected) => {
    const uuid = crypto.randomUUID();
    if (cutOffEnd !== -1) {
      hoistMap[uuid] = content.substring(cutOffStart, cutOffEnd);
      content =
        content.substring(0, cutOffStart) + uuid + content.substring(cutOffEnd);
    } else {
      hoistMap[uuid] = content.substring(cutOffStart);
      content = content.substring(0, cutOffStart) + uuid + expected;
    }
    return cutOffStart + uuid.length + expected.length;
  };

  while ((index = regexIndexOf(content, ESCAPABLES_REGEX, index)) !== -1) {
    const match = ESCAPABLES_REGEX.exec(content.substring(index));
    if (match.groups?.fence) {
      const fence = match.groups.fence;
      const fenceInfo = match.groups.fenceInfo;
      const closingFenceRegex = new RegExp("\n" + fence + "(\n|$)"); // Find the next fence. By commonmark spec, it should be the same fence length and type
      const nextIndex = regexIndexOf(
        content,
        closingFenceRegex,
        index + fence.length
      );

      const uuid = crypto.randomUUID();
      if (nextIndex !== -1) {
        hoistMap[uuid] = content.substring(
          index + fence.length + fenceInfo.length + 1,
          nextIndex
        );
      } else {
        hoistMap[uuid] = content.substring(
          index + fence.length + fenceInfo.length + 1
        );
      }
      // inject bbcode tag before and after the code block. This is to prevent BBob plugin from injecting newlines
      const replacement = `[saveNL]\n${fence}${fenceInfo}${uuid}\n${fence}\n[/saveNL]`;
      content =
        content.substring(0, index) +
        replacement +
        (nextIndex !== -1
          ? content.substring(nextIndex + 1 + fence.length)
          : "");

      index = index + replacement.length + fence.length;
    } else if (match.groups?.bbcode) {
      const bbcode = match.groups.bbcode;
      const bbcodeTag = match.groups.bbcodeTag.toLowerCase(); // coerce to lowercase for caseinsensitive matching
      const closingTag = `[/${bbcodeTag}]`;
      const nextIndex = content.toLowerCase().indexOf(closingTag, index + 1);
      index = addHoistAndReturnNewStartPoint(
        index + bbcode.length,
        nextIndex,
        closingTag
      );
    } else if (match.groups.backtick) {
      const backtick = match.groups.backtick; // contains whole content
      const tickStart = match.groups.tickStart;
      const tickEnd = match.groups.tickEnd;
      index = addHoistAndReturnNewStartPoint(
        index + tickStart.length,
        index + backtick.length - tickEnd.length,
        tickEnd
      );
    }
  }

  data.hoistMap = hoistMap;
  return [content, data];
}

/**
 * Preprocesses input to be formatted for bbob to intake. Handles any necessary functionality that BBob can't handle with a plugin (i.e. hoisting).
 * @param {string} raw input to preprocess
 * @returns formatted input for bbob to intake
 */
export function preprocessRaw(raw) {
  let data = {};
  const preprocessors = [fenceCodeBlockPreprocess];
  for (const preprocessor of preprocessors) {
    [raw, data] = preprocessor(raw, data);
  }
  return [raw, data];
}
