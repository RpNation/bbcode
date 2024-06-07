import { withPluginApi } from "discourse/lib/plugin-api";

const NAME_REGEX = /[^\s\]=/"']+/;
const QUOTE_STRING_ALLOW_NL = {
  scope: "string",
  begin: /'/,
  end: /'/,
  variants: [
    {
      begin: /"/,
      end: /"/,
    },
  ],
};
const OPEN_BRACKET = /\[/;
const CLOSE_BRACKET = /\]/;

const CLOSING_TAG = {
  scope: "tag",
  match: [/\[\//, NAME_REGEX, CLOSE_BRACKET],
  beginScope: {
    1: "punctuation",
    2: "name",
    3: "punctuation",
  },
  relevance: 2,
};
const OPENING_TAG_NO_ATTR = {
  scope: "tag",
  match: [OPEN_BRACKET, NAME_REGEX, CLOSE_BRACKET],
  beginScope: {
    1: "punctuation",
    2: "name",
    3: "punctuation",
  },
};

const OPENING_TAG_SINGLE_ATTR = {
  scope: "tag",
  begin: [OPEN_BRACKET, NAME_REGEX, /=/],
  end: /\]/,
  beginScope: {
    1: "punctuation",
    2: "name",
    3: "punctuation",
  },
  endScope: "punctuation",
  contains: [
    QUOTE_STRING_ALLOW_NL,
    {
      scope: "string",
      match: /[^\]]+/,
    },
  ],
  relevance: 2,
};

const OPENING_TAG_MULTI_ATTR = {
  scope: "tag",
  begin: [OPEN_BRACKET, NAME_REGEX, /\s/],
  end: /\]/,
  beginScope: {
    1: "punctuation",
    2: "name",
  },
  endScope: "punctuation",
  contains: [
    {
      begin: [/[\w-_]+/, /=/],
      beginScope: { 1: "attr", 2: "punctuation" },
      contains: [
        QUOTE_STRING_ALLOW_NL,
        {
          scope: "string",
          match: /[^\]\s]+/,
        },
      ],
    },
  ],
  relevance: 2,
};

function bbcodeHighlight() {
  return {
    name: "bbcode",
    case_insensitive: true,
    contains: [CLOSING_TAG, OPENING_TAG_NO_ATTR, OPENING_TAG_SINGLE_ATTR, OPENING_TAG_MULTI_ATTR],
  };
}

/**
 * Markdown Highlight js
 * copied from https://github.com/highlightjs/highlight.js/blob/888ac759dec65a6e18c7fbcf1c2154d5bd714437/src/languages/markdown.js
 * modified to work with bbcode
 */
function markdownHighlight(hljs) {
  const regex = hljs.regex;
  const INLINE_HTML = {
    begin: /<\/?[A-Za-z_]/,
    end: ">",
    subLanguage: "xml",
    relevance: 0,
  };
  const HORIZONTAL_RULE = {
    begin: "^[-\\*]{3,}",
    end: "$",
  };
  const CODE = {
    className: "code",
    variants: [
      // TODO: fix to allow these to work with sublanguage also
      { begin: "(`{3,})[^`](.|\\n)*?\\1`*[ ]*" },
      { begin: "(~{3,})[^~](.|\\n)*?\\1~*[ ]*" },
      // needed to allow markdown as a sublanguage to work
      {
        begin: "```",
        end: "```+[ ]*$",
      },
      {
        begin: "~~~",
        end: "~~~+[ ]*$",
      },
      { begin: "`.+?`" },
      {
        begin: "(?=^( {4}|\\t))",
        // use contains to gobble up multiple lines to allow the block to be whatever size
        // but only have a single open/close tag vs one per line
        contains: [
          {
            begin: "^( {4}|\\t)",
            end: "(\\n)$",
          },
        ],
        relevance: 0,
      },
    ],
  };
  const LIST = {
    className: "bullet",
    begin: "^[ \t]*([*+-]|(\\d+\\.))(?=\\s+)",
    end: "\\s+",
    excludeEnd: true,
  };
  const LINK_REFERENCE = {
    begin: /^\[[^\n]+\]:/,
    returnBegin: true,
    contains: [
      {
        className: "symbol",
        begin: /\[/,
        end: /\]/,
        excludeBegin: true,
        excludeEnd: true,
      },
      {
        className: "link",
        begin: /:\s*/,
        end: /$/,
        excludeBegin: true,
      },
    ],
  };
  const URL_SCHEME = /[A-Za-z][A-Za-z0-9+.-]*/;
  const LINK = {
    variants: [
      // too much like nested array access in so many languages
      // to have any real relevance
      {
        begin: /\[.+?\]\[.*?\]/,
        relevance: 0,
      },
      // popular internet URLs
      {
        begin: /\[.+?\]\(((data|javascript|mailto):|(?:http|ftp)s?:\/\/).*?\)/,
        relevance: 2,
      },
      {
        begin: regex.concat(/\[.+?\]\(/, URL_SCHEME, /:\/\/.*?\)/),
        relevance: 2,
      },
      // relative urls
      {
        begin: /\[.+?\]\([./?&#].*?\)/,
        relevance: 1,
      },
      // whatever else, lower relevance (might not be a link at all)
      {
        begin: /\[.*?\]\(.*?\)/,
        relevance: 0,
      },
    ],
    returnBegin: true,
    contains: [
      {
        // empty strings for alt or link text
        match: /\[(?=\])/,
      },
      {
        className: "string",
        relevance: 0,
        begin: "\\[",
        end: "\\]",
        excludeBegin: true,
        returnEnd: true,
      },
      {
        className: "link",
        relevance: 0,
        begin: "\\]\\(",
        end: "\\)",
        excludeBegin: true,
        excludeEnd: true,
      },
      {
        className: "symbol",
        relevance: 0,
        begin: "\\]\\[",
        end: "\\]",
        excludeBegin: true,
        excludeEnd: true,
      },
    ],
  };
  const BOLD = {
    className: "strong",
    contains: [], // defined later
    variants: [
      {
        begin: /_{2}(?!\s)/,
        end: /_{2}/,
      },
      {
        begin: /\*{2}(?!\s)/,
        end: /\*{2}/,
      },
    ],
  };
  const ITALIC = {
    className: "emphasis",
    contains: [], // defined later
    variants: [
      {
        begin: /\*(?![*\s])/,
        end: /\*/,
      },
      {
        begin: /_(?![_\s])/,
        end: /_/,
        relevance: 0,
      },
    ],
  };

  // 3 level deep nesting is not allowed because it would create confusion
  // in cases like `***testing***` because where we don't know if the last
  // `***` is starting a new bold/italic or finishing the last one
  const BOLD_WITHOUT_ITALIC = hljs.inherit(BOLD, { contains: [] });
  const ITALIC_WITHOUT_BOLD = hljs.inherit(ITALIC, { contains: [] });
  BOLD.contains.push(ITALIC_WITHOUT_BOLD);
  ITALIC.contains.push(BOLD_WITHOUT_ITALIC);

  let CONTAINABLE = [
    INLINE_HTML,
    LINK,
    // inject BBCode related syntax
    CLOSING_TAG,
    OPENING_TAG_NO_ATTR,
    OPENING_TAG_SINGLE_ATTR,
    OPENING_TAG_MULTI_ATTR,
  ];

  [BOLD, ITALIC, BOLD_WITHOUT_ITALIC, ITALIC_WITHOUT_BOLD].forEach((m) => {
    m.contains = m.contains.concat(CONTAINABLE);
  });

  CONTAINABLE = CONTAINABLE.concat(BOLD, ITALIC);

  const HEADER = {
    className: "section",
    variants: [
      {
        begin: "^#{1,6}",
        end: "$",
        contains: CONTAINABLE,
      },
      {
        begin: "(?=^.+?\\n[=-]{2,}$)",
        contains: [
          { begin: "^[=-]*$" },
          {
            begin: "^",
            end: "\\n",
            contains: CONTAINABLE,
          },
        ],
      },
    ],
  };

  const BLOCKQUOTE = {
    className: "quote",
    begin: "^>\\s+",
    contains: CONTAINABLE,
    end: "$",
  };

  const ENTITY = {
    //https://spec.commonmark.org/0.31.2/#entity-references
    scope: "literal",
    match: /&([a-zA-Z0-9]+|#[0-9]{1,7}|#[Xx][0-9a-fA-F]{1,6});/,
  };

  return {
    name: "Markdown",
    aliases: ["md", "mkdown", "mkd"],
    contains: [
      HEADER,
      INLINE_HTML,
      LIST,
      BOLD,
      ITALIC,
      BLOCKQUOTE,
      CODE,
      HORIZONTAL_RULE,
      LINK,
      LINK_REFERENCE,
      ENTITY,
      // inject BBCode related syntax
      CLOSING_TAG,
      OPENING_TAG_NO_ATTR,
      OPENING_TAG_SINGLE_ATTR,
      OPENING_TAG_MULTI_ATTR,
    ],
  };
}

/**
 * The initial call function.
 * Any calls to the PluginAPI should be done in here
 * @param api
 */
function registerHighlightJs(api) {
  api.registerHighlightJSLanguage("bbcode", bbcodeHighlight);
  api.registerHighlightJSLanguage("Markdown", markdownHighlight);
}

export default {
  name: "hightlight-js-bbcode",
  initialize() {
    withPluginApi("1.4.0", registerHighlightJs);
  },
};
