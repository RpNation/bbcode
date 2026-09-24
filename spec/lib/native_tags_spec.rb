# frozen_string_literal: true

RSpec.describe PrettyText do
  before do
    SiteSetting.bbcode_enabled = true
    PrettyText.reset_context
  end

  after { PrettyText.reset_context }

  # as a post is cooked, [comment]s included
  def cook(raw)
    BbCode::Comments.restore(PrettyText.cook(raw)).gsub(/post-[a-z0-9]{5}/, "post-GUID")
  end

  it "reads unquoted multi-token and multi-line attribute values as a single value" do
    html = cook("[div=height:auto; width:100%;\n\npadding:7px]text[/div]")

    expect(html).to include(%(style="height:auto; width:100%;\n\npadding:7px"))
    expect(html).to end_with(">text</div>")
  end

  it "reads quoted key=value attributes and suffixes class names per post" do
    html = cook(%([div class="a b" style="color:blue"]hi[/div]))

    expect(html).to include(%(class="a__post-GUID b__post-GUID"))
    expect(html).to include(%(style="color:blue"))
  end

  it "parses block markdown inside a container that starts its own line" do
    html = cook("[div=color:red]\n# Heading\n\n- one\n- two\n[/div]")

    expect(html).to include("<h1>")
    expect(html).to include("<li>one</li>")
  end

  it "keeps flow text across blank lines as one styled run with line breaks" do
    html = cook("[b]para one\n\npara two[/b]")

    expect(html).to include(%(<span class="bbcode-b">para one<br>\n<br>\npara two</span>))
  end

  it "pairs nested tags that span a blank line" do
    html = cook("[b]outer [b]nested\n\nacross[/b] more[/b]")

    expect(html.scan('<span class="bbcode-b">').length).to eq(2)
    expect(html).not_to include("\\")
  end

  it "closes a mis-nested tag with its parent and drops its later close" do
    expect(cook("[b]bold [i]both[/b] italic[/i]")).to eq(
      %(<span class="bbcode-b">bold <span class="bbcode-i">both</span></span> italic),
    )
    expect(cook("[center][b]x[/center] y[/b]")).to match(
      %r{<span class="bbcode-b">x</span></div>\s*y\z},
    )
    expect(cook("[url=https://e.com][b]x[/url] y[/b]")).to include(
      %(<span class="bbcode-b">x</span></a> y),
    )
    expect(cook("[b]a[plain][i]x[/b][/plain] c[/b]")).to include("a[i]x[/b] c</span>")
    expect(cook("[b][i]x[/b]")).to eq(%(<span class="bbcode-b">[i]x</span>))
  end

  it "leaves unclosed and unmatched tags as literal text" do
    expect(cook("[div=a:b]unclosed")).to eq("[div=a:b]unclosed")
    expect(cook("text [/b] more")).to eq("text [/b] more")
    expect(cook("[b]a [b]b[/b] c")).to eq(%([b]a <span class="bbcode-b">b</span> c))
  end

  it "reads a backslash-escaped opener as text, as markdown does" do
    expect(cook("\\[b][i]x[/b] y[/i]")).to eq(%([b]<span class="bbcode-i">x[/b] y</span>))
    expect(cook("[b]a \\[b] c[/b] d[/b]")).to eq(%(<span class="bbcode-b">a [b] c</span> d[/b]))
  end

  it "keeps a backslash before a close as text, as XenForo does" do
    expect(cook("[div=x]a \\[/div] b")).to match(%r{\A<div style="x">a \\</div>\s*b\z})
  end

  it "does not touch core markdown" do
    html = cook("# Title\n\n---\n\n- a\n- b")

    expect(html).to include("<h1>", "<hr>", "<li>a</li>")
  end

  it "turns every newline between blocks and inside containers into a line break" do
    expect(cook("a\n[div=x]b[/div]")).to eq(%(a<br><div style="x">b</div>))
    expect(cook("[div=x]\nb\n[/div]")).to include("<br>\nb<br>\n</div>")
  end

  it "counts one blank line around a markdown block as its margin" do
    visible = ->(raw) { cook(raw).gsub(%r{<a name[^>]*></a>}, "").delete("\n") }

    expect(visible["a\n\n# H\n\nb"]).to eq("a<br><h1>H</h1>b")
    expect(visible["a\n\n\n# H\n\n\nb"]).to eq("a<br><br><h1>H</h1><br>b")
    expect(visible["a\n\n\n- x\n\n\nb"]).to eq("a<br><br><ul><li>x</li></ul><br>b")
    expect(visible["# A\n\n\n# B"]).to eq("<h1>A</h1><br><h1>B</h1>")
  end

  it "suppresses line breaks inside nobr" do
    expect(cook("[nobr]a\nb\n\n[div=x]c[/div][/nobr]")).not_to include("<br>")
    expect(cook("[b]x [nobr]a\nb[/nobr][/b]")).to eq(%(<span class="bbcode-b">x a\nb</span>))
  end

  it "keeps every newline inside nobr as a newline" do
    expect(cook("[nobr]a\n\nb[/nobr]")).to eq("a\n\nb")
    expect(cook("x [nobr]a\n\nb[/nobr] y")).to eq("x a\n\nb y")
    expect(cook("[b]\n# H\nx [nobr]a\nb[/nobr]\n[/b]")).to include("</h1>\nx a\nb<br>")
    expect(cook("[nobr]\n[b]a\n\nb[/b]\n[/nobr]")).to eq(%(<span class="bbcode-b">a\n\nb</span>))
  end

  it "renders class templates with the same suffix as native tags" do
    html = cook("[class name=x]\ncolor:red;\n[/class]\n[div class=x]hi[/div]")

    expect(html).to include(%(<template data-bbcode-plus="class">.x__post-GUID {))
    expect(html).to include(%(<div class="x__post-GUID">))
  end

  it "renders script and animation templates and fa icons" do
    html = cook("[script class=box on=click version=2]\nshow box\n[/script]")
    expect(html).to include(
      %(<template data-bbcode-plus="script" data-bbscript-id="post-GUID" data-bbscript-class="box" data-bbscript-on="click" data-bbscript-ver="2">),
    )

    animation =
      cook("[animation=spin][keyframe=0]a: b;[/keyframe][keyframe=to]c: d;[/keyframe][/animation]")
    expect(animation).to include("@keyframes post-GUIDspin { 0%{ a: b; }\nto{ c: d; } }")
    expect(cook("[keyframe=0]stray[/keyframe]")).to eq("[keyframe=0]stray[/keyframe]")

    expect(cook(%(x [fa style="color:red" primary-color=red]fa-star[/fa] y))).to include(
      %(<i data-bbcode-fa=""><i class="fa-star" style="color:red; --fa-primary-color: red"),
    )
  end

  it "strips the bbcode-plus marker from templates written as raw HTML" do
    block = cook(%(<template data-bbcode-plus="script" data-bbscript-id="__proto__">x</template>))
    inline = cook(%(a <TEMPLATE Data-BbCode-Plus="class">.d-header{display:none}</TEMPLATE> b))

    expect(block).to eq(%(<template data-bbscript-id="__proto__">x</template>))
    expect(inline).to eq("a <template>.d-header{display:none}</template> b")
  end

  it "drops class, animation and keyframe rules whose name could escape the rule" do
    html =
      cook(
        "[class name=\"x{} .d-header{display:none} .y\"]color:red[/class]" \
          "[animation=x{} .d-header{display:none} y][keyframe=0]a: b;[/keyframe][/animation]",
      )
    frames =
      cook(
        "[animation=spin][keyframe=\"0{}}.d-header{display:none}@keyframes z{0\"]a:b;[/keyframe]" \
          "[keyframe=25%, 75%]c:d;[/keyframe][/animation]",
      )

    expect(html).not_to include("template")
    expect(frames).to eq(
      %(<template data-bbcode-plus="class">@keyframes post-GUIDspin { 25%, 75%{ c:d; } }</template>),
    )
  end

  it "blanks a script class that isn't a single class name" do
    html = cook(%([script class="a, .d-header, .b"](hide)[/script]))

    expect(html).to include(%(data-bbscript-class=""))
  end

  it "escapes script and class bodies so they can't close their template" do
    script = cook(%([script class=box](print "<b>hi</b>" "</template><b>x</b>")[/script]))
    style = cook("[class name=x]color:red</template><b>leak</b>[/class]")

    expect(script).to eq(
      %(<template data-bbcode-plus="script" data-bbscript-id="post-GUID" data-bbscript-class="box" data-bbscript-on="init" data-bbscript-ver="">(print "&lt;b&gt;hi&lt;/b&gt;" "&lt;/template&gt;&lt;b&gt;x&lt;/b&gt;")</template>),
    )
    expect(style).to eq(
      %(<template data-bbcode-plus="class">.x__post-GUID {color:red&lt;/template&gt;&lt;b&gt;leak&lt;/b&gt;}</template>),
    )
  end

  it "renders heading tags" do
    expect(cook("[h1]Title[/h1]")).to match(%r{<h1>\s*Title</h1>})
    expect(cook("x [sh]mid[/sh] y")).to eq("x <h2>mid</h2> y")
  end

  it "keeps tags nested in a link working" do
    html = cook("[url=https://example.com][b]x[/b][/url]")

    expect(html).to include(%(<a href="https://example.com"))
    expect(html).to include(%(<span class="bbcode-b">x</span>))
  end

  it "leaves code blocks and code spans untouched" do
    expect(cook("x\n[code]\n    [div=x]\n        foo\n[/div]\n[/code]")).to include(
      "    [div=x]\n        foo\n[/div]",
    )
    expect(cook("`[div=x]\na[/div]` after")).to eq("<code>[div=x] a[/div]</code> after")
    expect(cook("```\n[div=x]\n\nq\n[/div]\n```")).to include("[div=x]\n\nq\n[/div]")
  end

  it "renders wrapper tags" do
    expect(cook("[progress=40]a[/progress]")).to include(
      %(<div class="bb-progress">),
      %(<div class="bb-progress-text">),
      %(style="width: calc(40% - 6px)"),
    )
    expect(cook("[fieldset=Title]a[/fieldset]")).to match(
      %r{<legend class="bb-fieldset-legend">\s*Title</legend>},
    )
    expect(cook("[print=bogus]a[/print]")).to include(%(class="bb-print"))
    expect(cook("[column=6]a[/column]")).to include(%(data-span="column-width-span6"))
  end

  it "keeps text before a tag that renders no wrapper in place" do
    expect(cook("x [color=]a[/color] y")).to eq("x a y")
  end

  it "renders block, mail, size and font tags" do
    expect(cook("[block=dice]a[/block]")).to match(
      %r{<div class="bb-block" data-bb-block="dice">\s*a</div>},
    )
    expect(cook("[block=bogus]a[/block]")).to include(%(data-bb-block="block"))
    mail = cook(%([mail type=receive person="Bob" subject="Hi"]x[/mail]))
    expect(mail).to include(%(data-bb-email="receive"))
    expect(mail).to match(%r{bb-email-address">\s*Bob</div>})
    expect(mail).to match(%r{bb-email-subject">\s*Hi</div>})
    expect(cook("x [size=20px]a[/size] y")).to include(%(<span style="font-size: 20px">a</span>))
    expect(cook("x [size=big]a[/size] y")).to eq("x a y")
    expect(cook(%([font family="Roboto Flex" style="bold italic"]a[/font]))).to include(
      %(data-font="https://fonts.googleapis.com/css2?family=Roboto+Flex:ital,wght@1,700"),
      "font-style: italic",
    )
  end

  it "wraps a multi-line font, size or color in a div that renders block markdown" do
    html = cook("[font=Poppins]\n# Title\n\n- a\n[/font]")

    expect(html).to start_with(%(<div style="font-family: 'Poppins'))
    expect(html).to include("<h1>", "<li>a</li>")
    expect(cook("[size=5]\n# T\n[/size]")).to start_with(%(<div data-size="5">))
    expect(cook("[color=red]\n# T\n[/color]")).to start_with(%(<div style="color: red">))
  end

  it "keeps inline styling tags inline across lines unless they hold markdown blocks" do
    expect(cook("x [color=red]a\nb[/color] y")).to eq(
      %(x <span style="color: red">a<br>\nb</span> y),
    )
    expect(cook("[b]a\n\nb[/b] tail")).to start_with(%(<span class="bbcode-b">a<br>))
    expect(cook("x [i]# not a heading\nb[/i] y")).to include(%(<span class="bbcode-i"># not))
    expect(cook("x [b]a\n[plain]\n# literal\n[/plain][/b]")).to include(%(<span class="bbcode-b">))

    html = cook("[b]\n# heading\n- item\n[/b]")
    expect(html).to start_with(%(<div class="bbcode-b">))
    expect(html).to include("<h1>", "<li>item</li>")
    expect(cook("x [i]a\n- one\n- two[/i] y")).to include(%(<div class="bbcode-i">), "<li>one</li>")
  end

  it "counts the blocks markdown-it and other plugins end a paragraph with, and no others" do
    SiteSetting.discourse_math_enabled = true

    expect(cook("[b]a\n$$\nx\n$$\nb[/b]")).to include(
      %(<div class="bbcode-b">),
      %(<div class="math">),
    )
    expect(cook("[b]a\n[wrap=x]\ny\n[/wrap]\nb[/b]")).to include(
      %(<div class="bbcode-b">),
      %(<div class="d-wrap" data-wrap="x">),
    )
    expect(cook("[b]a\n<details>\n<summary>s</summary>\nx\n</details>\nb[/b]")).to start_with(
      %(<div class="bbcode-b">),
    )
    expect(cook("[b]a\n-\nb[/b]")).to include("<h2>")
    # only a list starting at 1 can interrupt text
    expect(cook("[b]a\n2. two\nb[/b]")).to start_with(%(<span class="bbcode-b">))
    expect(cook("[b]a\n[bg=red]x[/bg]\nb[/b]")).to start_with(%(<span class="bbcode-b">))
  end

  it "renders markdown blocks in a container nested in an inline tag" do
    html = cook("[b]text [div=x]a\n\n# heading\n- item\n[/div] more[/b]")

    expect(html).to start_with(%(<div class="bbcode-b">))
    expect(html).to include(%(<div style="x">), "<h1>", "<li>item</li>")
  end

  it "keeps a single-line font at the start of a line inline" do
    expect(cook("[font=Poppins]hi[/font] there")).to start_with(%(<span style="font-family))
  end

  it "renders blockquote, anchor, goto and inlinespoiler tags" do
    quote = cook("[blockquote=Alice]hi[/blockquote]")
    expect(quote).to include(
      %(<div class="bb-blockquote">),
      "bb-blockquote-left",
      "bb-blockquote-right",
    )
    expect(quote).to match(%r{bb-blockquote-speaker">\s*- Alice</div>})
    expect(cook("x [a=top]t[/a] y")).to include(%(id="user-anchor-top"), %(name="user-anchor-top"))
    expect(cook("[goto=top]j[/goto]")).to include(%(href="#user-anchor-top"))
    expect(cook("[inlinespoiler]s[/inlinespoiler]")).to include(
      %(<span class="bb-inline-spoiler">s</span>),
    )
  end

  it "renders tabs from their direct tab children and drops anything between them" do
    html =
      cook(
        "[tabs]junk [tab=One]first[/tab] more[tab name=\"Two\" style=\"color:red\"]**b**[/tab][/tabs]",
      )

    expect(html.scan(%(<input type="radio")).length).to eq(2)
    expect(html.scan("checked").length).to eq(1)
    expect(html).to match(%r{>\s*One</label>})
    expect(html).to include(%(style="color:red"), "<strong>b</strong>")
    expect(html).not_to include("junk", "more")
    expect(cook("[tabs]no tabs[/tabs]")).to eq("[tabs]no tabs[/tabs]")
    expect(cook("[tab=X]bare[/tab]")).to eq("[tab=X]bare[/tab]")
  end

  it "renders accordions from bracket and brace slides with block markdown inside" do
    html = cook(<<~BBCODE)
      [accordion=bright|300px]
      {slide=[b]Old[/b] style|open|right}
      # Heading

      text
      {/slide}
      [slide title="New"]body **two**[/slide]
      [/accordion]
    BBCODE

    expect(html).to include(%(class="bb-accordion bright"), "width: 300px;")
    expect(html).to include(%(<details class="bb-slide" open=""))
    expect(html).to include("text-align: right;", "<h1>", "<strong>two</strong>")
    expect(html.scan("<summary").length).to eq(2)
    expect(cook("[accordion]no slides[/accordion]")).to eq("[accordion]no slides[/accordion]")
    expect(cook("[accordion]{slide=T}Before `{/slide}` after{/slide}[/accordion]")).to include(
      "Before <code>{/slide}</code> after</div>",
    )
  end

  it "renders textmessage conversations" do
    html =
      cook(
        "[textmessage=Ann][message=them]Hi[/message][message=me]Hey **you**[/message][/textmessage]",
      )

    expect(html).to include("bb-textmessage-name", "bb-message-them", "bb-message-me")
    expect(html).to include("<strong>you</strong>")
  end

  it "keeps the line breaks before a nobr block" do
    expect(cook("a\n\n[nobr]b\nc[/nobr]\n\nd")).to start_with("a<br><br>").and end_with("<br><br>d")
  end

  it "keeps a native container flow when it is nested inside [url], even across a blank line" do
    html = cook("[url=https://example.com][div=color:red]a\n\nb[/div][/url]")

    expect(html).to start_with(%(<a href="https://example.com"))
    expect(html).to include(%(<div style="color:red">a<br>))
    expect(html).to match(%r{<br>\s*b</div></a>})
  end

  it "renders comments as HTML comments and still loads the Google fonts named inside" do
    html = cook("a [comment]note [font=Poppins]x[/font] --> <b>y</b>[/comment] b")

    expect(html).to include(
      %(<span data-font="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400"></span>),
      "<!--note [font=Poppins]x[/font] --&gt; &lt;b&gt;y&lt;/b&gt;-->",
    )
    expect(html).not_to include("<b>")
  end

  it "writes every newline after a tag as a line break" do
    expect(cook("[div=x]a[/div]\nnext").scan("<br>").size).to eq(1)
    expect(cook("[div=x]a[/div]\n\nnext").scan("<br>").size).to eq(2)
    expect(cook("[center]\na\n[/center]\nnext").scan("<br>").size).to eq(3)
  end

  it "drops the line break right after tags XenForo trims after, unless text comes first" do
    expect(cook("text[divide][/divide]\nnext")).not_to include("<br>")
    expect(cook("text[divide][/divide]\n\nnext").scan("<br>").size).to eq(1)
    expect(cook("[divide][/divide] tail\nnext").scan("<br>").size).to eq(1)
    expect(cook("[quote]\na\n[/quote]\n\nnext").scan("<br>").size).to eq(1)
    expect(cook("[code]\na\n[/code]\nnext")).not_to include("<br>")
    expect(cook("[spoiler=T]a[/spoiler]\nnext")).not_to include("<br>")
  end

  it "trims the line breaks just inside spoilers and quotes" do
    expect(cook("[spoiler=T]\n\na\n\n[/spoiler]")).to match(%r{bb-spoiler-content">\s*a</div>})
    expect(cook("[quote]\n\na\n\n[/quote]")).to match(%r{<blockquote>\s*a</blockquote>})
    expect(cook("x [inlinespoiler]\na\n[/inlinespoiler] y")).to include(
      %(<span class="bb-inline-spoiler">a</span>),
    )
  end

  it "renders a code tag spanning lines as a code block wherever its tags sit" do
    expect(cook("[code]a\n\nb[/code] tail")).to include(
      %(<pre><code class="lang-auto">a\n\nb</code></pre>),
    )
    expect(cook("x [code]a\nb[/code] y")).to match(
      %r{\Ax<pre><code class="lang-auto">a\nb</code></pre>\s*y\z},
    )
    expect(cook("x [code]a[/code] y")).to eq("x <code>a</code> y")
  end

  it "never reads content on the same line as both tags as markdown blocks" do
    expect(cook("[div=x]+[/div]")).to eq(%(<div style="x">+</div>))
    expect(cook("[center]# Title[/center]")).to eq(%(<div class="bb-center"># Title</div>))
    expect(cook("[center]\n# Title\n[/center]")).to include("<h1>")
    expect(cook("[tabs][tab=A]- x[/tab][/tabs]")).to include(
      %(<div class="bb-tab-content">- x</div>),
    )
  end

  it "trims the line breaks just inside blockquote, ooc and progress" do
    expect(cook("[blockquote=Al]\n\nhi\n\n[/blockquote]")).to match(
      /bb-blockquote-content">\s*hi<div class="bb-blockquote-speaker">/,
    )
    expect(cook("[ooc]\nx\n[/ooc]")).to match(%r{<div class="bb-ooc">\s*x</div>})
    expect(cook("[progress=40]\nx\n[/progress]")).to match(%r{bb-progress-text">\s*x</div>})
    expect(cook("[progress=40]x[/progress]")).to include(%(<div class="bb-progress-bar-other">))
  end

  it "keeps code content as written, apart from the lines the tags sit on" do
    expect(cook("[code]\n\n  a\n[/code]")).to include(%(<code class="lang-auto">\n  a</code>))
    expect(cook("x [icode]\na\n[/icode] y")).to include("<code>a</code>")
  end

  it "keeps icode and plain spanning a blank line mid-paragraph literal" do
    expect(cook("x [icode][b]a\n\nb[/b][/icode] y")).to include("<code>[b]a")
    expect(cook("x [plain][b]a[/b]\n\nb[/plain] y")).to include("[b]a[/b]")
  end

  it "shows plain text exactly as written" do
    expect(cook("[plain]:smile: @system #general <b>x</b> & https://e.com[/plain]")).to eq(
      ":smile: @system #general &lt;b&gt;x&lt;/b&gt; &amp; https://e.com",
    )
  end

  it "ignores tags inside literal tags when matching others" do
    expect(cook("[div=x]a [comment]old [div] start[/comment] b[/div]")).to eq(
      %(<div style="x">a <!--old [div] start--> b</div>),
    )
    expect(cook("[div=x][script]x[/div]y[/script]z[/div]")).to include(
      ">x[/div]y</template>",
      %(<div style="x">z</div>),
    )
  end

  it "reads a literal tag shown in a code span as code, not as the start of literal text" do
    expect(cook("`[plain]`\n[color=red]red[/color]\n`[/plain]`")).to eq(
      %(<code>[plain]</code><br>\n<span style="color: red">red</span><br>\n<code>[/plain]</code>),
    )
    expect(cook("[plain]a `b[/plain] [b]c[/b]`")).to eq(%(a `b<span class="bbcode-b">c</span>`))
  end

  it "keeps the line break after plain and icode that start a line" do
    expect(cook("[icode]a[/icode]\nnext")).to include("<code>a</code><br>")
    expect(cook("[plain]a[/plain]\nnext")).to include("a<br>")
  end

  it "writes the newlines in plain text as line breaks and drops the one after a fence" do
    expect(cook("x\n[plain]\na\n[/plain]\ny").scan("<br>").size).to eq(4)
    expect(cook("```\na\n```\nnext")).not_to include("<br>")
  end

  it "matches tags regardless of case" do
    expect(cook("[CENTER]a[/center]")).to include(%(<div class="bb-center">a</div>))
  end
end
