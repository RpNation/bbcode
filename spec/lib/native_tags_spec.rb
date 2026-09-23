# frozen_string_literal: true

RSpec.describe PrettyText do
  before do
    SiteSetting.bbcode_enabled = true
    SiteSetting.bbcode_native_tags = "*"
    PrettyText.reset_context
  end

  after { PrettyText.reset_context }

  def cook(raw)
    PrettyText.cook(raw).gsub(/post-[a-z0-9]{5}/, "post-GUID")
  end

  it "reads unquoted multi-token and multi-line attribute values as a single value" do
    html = cook("[div=height:auto; width:100%;\n\npadding:7px]text[/div]")

    expect(html).to include(%(style="height:auto; width:100%;\n\npadding:7px"))
    expect(html).to end_with("\ntext</div>")
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

  it "leaves unclosed and unmatched tags as literal text" do
    expect(cook("[div=a:b]unclosed")).to eq("[div=a:b]unclosed")
    expect(cook("text [/b] more")).to eq("text [/b] more")
  end

  it "does not touch core markdown" do
    html = cook("# Title\n\n---\n\n- a\n- b")

    expect(html).to include("<h1>", "<hr>", "<li>a</li>")
  end

  it "turns every newline between blocks and inside containers into a line break" do
    expect(cook("a\n[div=x]b[/div]")).to eq(%(a<br><div style="x">\nb</div>))
    expect(cook("[div=x]\nb\n[/div]")).to include("<br>\nb<br>\n</div>")
  end

  it "suppresses line breaks inside nobr" do
    expect(cook("[nobr]a\nb\n\n[div=x]c[/div][/nobr]")).not_to include("<br>")
  end

  it "renders class templates with the same suffix as native tags" do
    html = cook("[class name=x]\ncolor:red;\n[/class]\n[div class=x]hi[/div]")

    expect(html).to include(%(<template data-bbcode-plus="class">.x__post-GUID {))
    expect(html).to include(%(<div class="x__post-GUID">))
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

  it "renders wrapper tags with the same HTML the BBob path produces" do
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

  it "keeps code content as written, apart from the lines the tags sit on" do
    expect(cook("[code]\n\n  a\n[/code]")).to include(%(<code class="lang-auto">\n  a</code>))
    expect(cook("x [icode]\na\n[/icode] y")).to include("<code>a</code>")
  end

  it "keeps icode and plain spanning a blank line mid-paragraph literal" do
    expect(cook("x [icode][b]a\n\nb[/b][/icode] y")).to include("<code>[b]a")
    expect(cook("x [plain][b]a[/b]\n\nb[/plain] y")).to include("[b]a[/b]")
  end

  it "keeps the line break after plain and icode that start a line" do
    expect(cook("[icode]a[/icode]\nnext")).to include("<code>a</code><br>")
    expect(cook("[plain]a[/plain]\nnext")).to include("a<br>")
  end

  context "with the BBob renderer" do
    before do
      SiteSetting.bbcode_native_tags = ""
      PrettyText.reset_context
    end

    it "breaks lines like the native renderer" do
      expect(cook("text[divide][/divide]\nnext")).not_to include("<br>")
      expect(cook("text[divide][/divide]\n\nnext").scan("<br>").size).to eq(1)
      expect(cook("[divide][/divide] tail\nnext").scan("<br>").size).to eq(1)
      expect(cook("[quote]\na\n[/quote]\n\nnext").scan("<br>").size).to eq(1)
      expect(cook("[code]\na\n[/code]\nnext")).not_to include("<br>")
      expect(cook("[spoiler=T]a[/spoiler]\nnext")).not_to include("<br>")
      expect(cook("[div=x]a[/div]\nnext").scan("<br>").size).to eq(1)
      expect(cook("x\n[plain]\na\n[/plain]\ny").scan("<br>").size).to eq(4)
      expect(cook("```\na\n```\nnext")).not_to include("<br>")
    end

    it "trims the line breaks just inside spoilers and quotes" do
      expect(cook("[spoiler=T]\n\na\n\n[/spoiler]")).to include(%(bb-spoiler-content">a</div>))
      expect(cook("[quote]\n\na\n\n[/quote]")).to match(%r{<blockquote>\s*a</blockquote>})
      expect(cook("x [inlinespoiler]\na\n[/inlinespoiler] y")).to include(
        %(<span class="bb-inline-spoiler">a</span>),
      )
    end

    it "matches tags regardless of case" do
      expect(cook("[CENTER]a[/center]")).to include(%(<div class="bb-center">a</div>))
    end

    it "keeps the words of a multi-line attribute value apart" do
      expect(cook("[div=border:1px\nsolid\tred]a[/div]")).to include(
        %(style="border:1px solid red"),
      )
    end

    it "renders a quote without an author" do
      expect(cook("[quote]a[/quote]")).not_to include("undefined")
    end
  end
end
