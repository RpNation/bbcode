# frozen_string_literal: true

# Writes the tag-*.txt recook groups: every tag in every context below, and
# each tag's attribute variants. Run it after changing the tables, then
# rewrite the snapshots (see spec/lib/recook_spec.rb):
#   ruby plugins/bbcode/spec/fixtures/recook/generate.rb

# open: the opener used in every context (default "[<tag>]")
# content: the text between the tags (default "text")
# variants: other openers, each cooked on its own line and around a block
TAGS = {
  # layout
  "div" => {
    open: "[div=color:red]",
    variants: [
      "[div]",
      "[div=color:red; padding: 4px]",
      %([div style="color:red" class="box"]),
      "[div class=box]",
      "[div class=\"a b\"]",
    ],
  },
  "left" => {
  },
  "center" => {
  },
  "right" => {
  },
  "justify" => {
  },
  "centerblock" => {
    open: "[centerblock=40]",
    variants: ["[centerblock]"],
  },
  "row" => {
    content: "[column=6]a[/column][column=6]b[/column]",
  },
  "column" => {
    open: "[column=6]",
    variants: ["[column]", "[column=span4]"],
  },
  "side" => {
    open: "[side=right]",
    variants: ["[side]", "[side=left]"],
  },
  "imagefloat" => {
    open: "[imagefloat=left]",
    variants: ["[imagefloat]", "[imagefloat=right]"],
  },
  "border" => {
    open: "[border=1px solid red]",
    variants: ["[border]"],
  },
  "bg" => {
    open: "[bg=red]",
    variants: ["[bg]"],
  },
  "heightrestrict" => {
    open: "[heightrestrict=100]",
    variants: %w[
      [heightrestrict]
      [heightrestrict=0]
      [heightrestrict=9999]
      [heightrestrict=-5]
      [heightrestrict=abc]
    ],
  },
  "scroll" => {
    open: "[scroll=200]",
    variants: %w[[scroll] [scroll=0] [scroll=9999] [scroll=abc]],
  },
  "divide" => {
    open: "[divide=dotted]",
    variants: %w[[divide] [divide=DASHED]],
  },
  "newspaper" => {
  },
  "check" => {
    open: "[check=x]",
    variants: ["[check]"],
  },
  "ooc" => {
  },
  # boxes
  "spoiler" => {
    open: "[spoiler=Title]",
    variants: ["[spoiler]", %([spoiler="Quoted title"])],
  },
  "print" => {
    open: "[print=line]",
    variants: %w[[print] [print=graph] [print=parchment] [print=unknown]],
  },
  "progress" => {
    open: "[progress=40]",
    variants: %w[[progress] [progress=150]],
  },
  "thinprogress" => {
    open: "[thinprogress=40]",
    variants: ["[thinprogress]"],
  },
  "note" => {
  },
  "fieldset" => {
    open: "[fieldset=Legend]",
    variants: ["[fieldset]"],
  },
  "block" => {
    open: "[block=warning]",
    variants: %w[[block] [block=DICE] [block=unknown]],
  },
  "mail" => {
    open: "[mail person=Bob subject=Hi]",
    variants: ["[mail]", %([mail type=receive person="Bob Smith" subject="Re: hi"])],
  },
  "blockquote" => {
    open: "[blockquote=Speaker]",
    variants: ["[blockquote]"],
  },
  "textmessage" => {
    open: "[textmessage=Bob]",
    content: "[message=them]hi[/message][message=me]yo[/message]",
    variants: ["[textmessage]"],
  },
  "message" => {
    open: "[message=me]",
    variants: %w[[message] [message=them] [message=left]],
  },
  # headings
  "h" => {
  },
  "h1" => {
  },
  "h2" => {
  },
  "h3" => {
  },
  "h4" => {
  },
  "h5" => {
  },
  "h6" => {
  },
  "sh" => {
  },
  # text styling
  "b" => {
  },
  "i" => {
  },
  "u" => {
  },
  "s" => {
  },
  "pindent" => {
  },
  "highlight" => {
  },
  "color" => {
    open: "[color=red]",
    variants: ["[color=#ff0000]", "[color]", %([color="blue"])],
  },
  "size" => {
    open: "[size=5]",
    variants: %w[[size=1] [size=7] [size=0] [size=12px] [size=40px] [size=1.5rem] [size=12pt]],
  },
  "font" => {
    open: "[font=Georgia]",
    variants: [
      "[font=Open Sans]",
      "[font=Lato style=bold]",
      "[font family=Roboto wght=300]",
      "[font=Arial size=3]",
    ],
  },
  "sub" => {
  },
  "sup" => {
  },
  "inlinespoiler" => {
  },
  # links and anchors
  "a" => {
    open: "[a=top]",
  },
  "goto" => {
    open: "[goto=top]",
  },
  # line breaks
  "br" => {
    content: "",
  },
  "nobr" => {
    content: "one\ntwo",
  },
  # literal content
  "plain" => {
    content: "[b]not bold[/b] :smile:",
  },
  "icode" => {
    content: "[b]x[/b] <b>y</b>",
  },
  "comment" => {
    content: "hidden [b]x[/b]",
  },
  # BBCode+
  "class" => {
    open: "[class name=box]",
    content: "color: red;",
    variants: [
      "[class name=box state=hover]",
      %([class name=box selector=" p"]),
      "[class name=box minWidth=100px]",
      %([class name="bad name"]),
    ],
  },
  "animation" => {
    open: "[animation=spin]",
    content: "[keyframe=0]opacity: 0;[/keyframe][keyframe=100]opacity: 1;[/keyframe]",
  },
  "script" => {
    open: "[script class=box on=click]",
    content: %((print "hi")),
    variants: %w[[script] [script on=bogus]],
  },
  "fa" => {
    content: "fas fa-dice",
    variants: [%([fa style="color:red" fa-transform=grow-2])],
  },
  # sections
  "tabs" => {
    content: "[tab=One]one[/tab][tab=Two]two[/tab]",
  },
  "accordion" => {
    content: "[slide=One]one[/slide][slide=Two open]two[/slide]",
    variants: ["[accordion=bright|50%]", "[accordion width=300px align=bcenter]"],
  },
  # core's own tags, which the plugin's tags meet
  "url" => {
    open: "[url=https://example.com]",
    variants: ["[url]"],
  },
  "quote" => {
    variants: [%([quote="system, post:1, topic:1"])],
  },
  "details" => {
    open: "[details=Summary]",
    variants: ["[details]"],
  },
  "code" => {
    content: "[b]x[/b]",
  },
  "wrap" => {
    open: "[wrap=box]",
  },
  "img" => {
    content: "https://example.com/a.png",
  },
  "email" => {
    content: "someone@example.com",
  },
}

# {O} the opener, {C} the close, {X} the content
CONTEXTS = {
  "alone" => "{O}{X}{C}",
  "empty" => "{O}{C}",
  "mid-line" => "before {O}{X}{C} after",
  "own-lines" => "{O}\n{X}\n{C}",
  "own-lines-between-text" => "before\n{O}\n{X}\n{C}\nafter",
  "starts-mid-line-spans-lines" => "before {O}{X}\nmore{C} after",
  "blank-line-inside" => "{O}\n{X}\n\nsecond paragraph\n{C}",
  "markdown-blocks-inside" => "{O}\n## Heading\n\n- one\n- two\n\n> quoted\n{C}",
  "inline-markdown-inside" => "{O}**bold** _italic_ `code` [link](https://example.com) :smile:{C}",
  "in-blockquote" => "> {O}\n> {X}\n> {C}",
  "in-list-item" => "- {O}\n  {X}\n  {C}\n- next",
  "in-table-cell" => "| head |\n|---|\n| {O}{X}{C} |",
  "in-heading" => "## {O}{X}{C}",
  "around-b" => "{O}[b]{X}[/b]{C}",
  "in-b" => "[b]before {O}{X}{C} after[/b]",
  "in-core-quote" => "[quote]\n{O}{X}{C}\n[/quote]",
  "misnested-with-i" => "{O}[i]{X}{C} tail[/i]",
  "nested-in-itself" => "{O}outer {O}inner{C} outer{C}",
  "repeated" => "{O}one{C}{O}two{C} {O}three{C}",
  "tail-and-next-line" => "{O}{X}{C} tail\nnext line",
  "blank-lines-around" => "before\n\n\n{O}{X}{C}\n\n\nafter",
  "unclosed" => "{O}{X}",
  "unmatched-close" => "{X}{C}",
  "escaped" => "\\{O}{X}{C}",
  "uppercase" => "{UO}{X}{UC}",
}

VARIANT_CONTEXTS = { "alone" => "{O}{X}{C}", "own-lines" => "{O}\n{X}\n{C}" }

def fill(template, open, close, content)
  upper = ->(tag) { tag.sub(%r{\A\[/?[a-z0-9]+}i, &:upcase) }
  template
    .gsub("{UO}", upper.(open))
    .gsub("{UC}", upper.(close))
    .gsub("{O}", open)
    .gsub("{C}", close)
    .gsub("{X}", content)
end

dir = __dir__
Dir[File.join(dir, "tag-*.txt")].each { |path| File.delete(path) }
TAGS.each do |tag, spec|
  open = spec[:open] || "[#{tag}]"
  close = "[/#{tag}]"
  content = spec[:content] || "text"
  cases = CONTEXTS.to_h { |name, template| [name, fill(template, open, close, content)] }
  (spec[:variants] || []).each do |variant|
    VARIANT_CONTEXTS.each do |name, template|
      cases["#{variant} #{name}"] = fill(template, variant, close, content)
    end
  end
  cases.each_value do |raw|
    raise "#{tag}: a case can't have a line starting with \"==== \"" if raw.match?(/^==== /)
  end
  File.write(
    File.join(dir, "tag-#{tag}.txt"),
    "Generated by generate.rb; edit that, not this file.\n" +
      cases.map { |name, raw| "==== #{name}\n#{raw}\n" }.join,
  )
end
puts "#{TAGS.size} tags, #{TAGS.size * CONTEXTS.size + TAGS.sum { |_, spec| (spec[:variants] || []).size * VARIANT_CONTEXTS.size }} cases"
