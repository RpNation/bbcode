# frozen_string_literal: true

RSpec.describe PrettyText do
  before { SiteSetting.bbcode_enabled = true }

  def bbcode_fragment(raw, **options)
    Nokogiri::HTML5.fragment(PrettyText.cook(raw, options))
  end

  it "cooks nested XenForo spoilers as independent, initially closed details" do
    fragment =
      bbcode_fragment(
        "[spoiler=Outer]Before [spoiler=Inner][b]Hidden text[/b][/spoiler] After[/spoiler]",
      )

    outer = fragment.at_css("details.bb-spoiler")
    inner = outer.at_css(".bb-spoiler-content details.bb-spoiler")

    expect(fragment.css("details.bb-spoiler").size).to eq(2)
    expect(outer.at_css("summary").text).to eq("Spoiler: Outer")
    expect(inner.at_css("summary").text).to eq("Spoiler: Inner")
    expect(inner.at_css(".bb-spoiler-content .bbcode-b").text).to eq("Hidden text")
    expect(outer.key?("open")).to eq(false)
    expect(inner.key?("open")).to eq(false)
    expect(outer.at_css(".bb-spoiler-content").text).to include("Before", "After")
  end

  it "accepts mixed-case legacy spoiler tags" do
    fragment = bbcode_fragment("[SPOILER=Example]Hidden [I]text[/I][/SPOILER]")

    expect(fragment.at_css("details.bb-spoiler > summary").text).to eq("Spoiler: Example")
    expect(fragment.at_css(".bb-spoiler-content .bbcode-i").text).to eq("text")
  end

  it "keeps formatted children inside an inline spoiler" do
    fragment = bbcode_fragment("Before [inlinespoiler][b]Hidden[/b][/inlinespoiler] after")

    expect(fragment.at_css("span.bb-inline-spoiler .bbcode-b").text).to eq("Hidden")
    expect(fragment.text).to include("Before", "after")
  end

  it "preserves literal guide examples in BBCode and Markdown code blocks" do
    example = "[spoiler=Example][b]Do not render this example[/b][/spoiler]"
    fragment = bbcode_fragment("[code]#{example}[/code]\n\n```bbcode\n#{example}\n```")

    expect(fragment.css("pre code").size).to eq(2)
    expect(fragment.css("pre code").map(&:text).map(&:strip)).to eq([example, example])
    expect(fragment.css("details, .bbcode-b")).to be_empty
  end

  it "preserves inline code and plain-tag examples used by the guide" do
    fragment =
      bbcode_fragment(
        "`[spoiler=Example]Hidden[/spoiler]` [plain][b]literal[/b][/plain] [b]rendered[/b]",
      )

    expect(fragment.at_css("code").text).to eq("[spoiler=Example]Hidden[/spoiler]")
    expect(fragment.text).to include("[b]literal[/b]")
    expect(fragment.css(".bbcode-b").map(&:text)).to eq(["rendered"])
    expect(fragment.css("details")).to be_empty
  end

  it "does not reinterpret part of an unmatched backtick run as a shorter delimiter" do
    fragment = bbcode_fragment("[b]Outside[/b] prefix ````example``` suffix")

    expect(fragment.css("code")).to be_empty
    expect(fragment.text).to include("prefix ````example``` suffix")
    expect(fragment.at_css(".bbcode-b").text).to eq("Outside")
  end

  it "keeps exact-length backtick delimiters and multiline inline examples" do
    fragment =
      bbcode_fragment("[b]Outside[/b] prefix ``one ` two`` suffix `alpha\n[b]literal[/b]\nbeta`")

    expect(fragment.css("code").size).to eq(2)
    expect(fragment.css("code").first.text).to eq("one ` two")
    expect(fragment.css("code").last.text).to include("alpha", "[b]literal[/b]", "beta")
    expect(fragment.css(".bbcode-b").map(&:text)).to eq(["Outside"])
  end

  it "shows HTML examples as text inside BBCode and Markdown code blocks" do
    example = '<div class="example">A & B</div>'
    fragment =
      bbcode_fragment("[code=html]#{example}[/code]\n\n```html\n#{example}\n```\n\n`#{example}`")

    expect(fragment.css("code").map(&:text).map(&:strip)).to eq([example, example, example])
    expect(fragment.css("code div, .example")).to be_empty
  end

  it "retains Markdown paragraphs when BBCode appears only inside a fenced example" do
    example = "[spoiler=Example]Hidden text[/spoiler]"
    fragment =
      bbcode_fragment("First **paragraph**.\n\n```bbcode\n#{example}\n```\n\nSecond paragraph.")

    expect(fragment.css("p").map(&:text)).to eq(["First paragraph.", "Second paragraph."])
    expect(fragment.at_css("strong").text).to eq("paragraph")
    expect(fragment.at_css("pre code").text.strip).to eq(example)
    expect(fragment.css("details")).to be_empty
  end

  it "retains Markdown paragraphs when BBCode appears only inside inline code" do
    example = "[div]A layout example[/div]"
    fragment = bbcode_fragment("First `#{example}` paragraph.\n\nSecond **paragraph**.")

    expect(fragment.css("p").map(&:text)).to eq(
      ["First #{example} paragraph.", "Second paragraph."],
    )
    expect(fragment.at_css("code").text).to eq(example)
    expect(fragment.at_css("strong").text).to eq("paragraph")
    expect(fragment.css("div")).to be_empty
  end

  it "retains native indented code containing BBCode examples" do
    fragment = bbcode_fragment(<<~MARKDOWN)
        First **paragraph**.

            [b]Literal bold example[/b]
            [spoiler=Example]Hidden text[/spoiler]

        Second paragraph.
      MARKDOWN

    expect(fragment.css("p").map(&:text)).to eq(["First paragraph.", "Second paragraph."])
    expect(fragment.at_css("strong").text).to eq("paragraph")
    expect(fragment.at_css("pre code").text.strip).to eq(
      "[b]Literal bold example[/b]\n[spoiler=Example]Hidden text[/spoiler]",
    )
    expect(fragment.css(".bbcode-b, details")).to be_empty
  end

  it "retains native tab-indented code containing a BBCode example" do
    example = "[spoiler=Example]Hidden text[/spoiler]"
    fragment = bbcode_fragment("First paragraph.\n\n\t#{example}\n\nSecond paragraph.")

    expect(fragment.css("p").map(&:text)).to eq(["First paragraph.", "Second paragraph."])
    expect(fragment.at_css("pre code").text.strip).to eq(example)
    expect(fragment.css("details")).to be_empty
  end

  it "preserves historical curly-brace accordion slides and their nested content" do
    fragment = bbcode_fragment(<<~BBCODE)
        [accordion]
        {slide=First|open}[spoiler=Secret][b]First body[/b][/spoiler]{/slide}
        {slide=Second}Second body{/slide}
        [/accordion]
      BBCODE
    slides = fragment.css(".bb-accordion > details.bb-slide")

    expect(slides.size).to eq(2)
    expect(slides.map { |slide| slide.at_css("summary").text }).to eq(%w[First Second])
    expect(slides.first.key?("open")).to eq(true)
    expect(slides.last.key?("open")).to eq(false)
    expect(slides.first.at_css(".bb-slide-content details.bb-spoiler .bbcode-b").text).to eq(
      "First body",
    )
    expect(slides.last.at_css(".bb-slide-content").text).to eq("Second body")
  end

  it "gives separate tab sets independent controls and matching labels" do
    fragment =
      bbcode_fragment(
        "[tabs][tab=First]One[/tab][tab=Second]Two[/tab][/tabs]\n" \
          "[tabs][tab=First]Three[/tab][tab=Second]Four[/tab][/tabs]",
      )
    groups = fragment.css(".bb-tabs")
    inputs = fragment.css("input.bb-tab")

    expect(groups.size).to eq(2)
    expect(inputs.size).to eq(4)
    expect(inputs.map { |input| input["id"] }.uniq.size).to eq(4)
    expect(inputs.map { |input| input["name"] }.uniq.size).to eq(2)
    expect(fragment.css("label.bb-tab-label").map { |label| label["for"] }).to eq(
      inputs.map { |input| input["id"] },
    )
    groups.each do |group|
      expect(group.css("input[checked]").size).to eq(1)
      expect(group.css(".bb-tab-content").size).to eq(2)
    end
  end

  it "preserves nested column layout and fieldset content through sanitization" do
    fragment =
      bbcode_fragment(
        "[row][column=4][fieldset=Character][b]Name[/b][/fieldset][/column]" \
          "[column=8][spoiler=History]Story[/spoiler][/column][/row]",
      )
    columns = fragment.css(".bb-row > .bb-column")

    expect(columns.size).to eq(2)
    expect(columns.map { |column| column["data-span"] }).to eq(
      %w[column-width-span4 column-width-span8],
    )
    expect(columns.first.at_css("fieldset.bb-fieldset legend").text).to eq("Character")
    expect(columns.first.at_css("fieldset.bb-fieldset .bbcode-b").text).to eq("Name")
    expect(columns.last.at_css("details.bb-spoiler .bb-spoiler-content").text).to eq("Story")
  end

  it "retains native paragraphs, emphasis, lists and indented code for Markdown posts" do
    fragment = bbcode_fragment(<<~MARKDOWN)
        First paragraph with **bold**.

        Second paragraph.

        - One
        - Two

            standalone code
      MARKDOWN

    expect(fragment.css("p").map(&:text)).to include(
      "First paragraph with bold.",
      "Second paragraph.",
    )
    expect(fragment.at_css("strong").text).to eq("bold")
    expect(fragment.css("ul > li").size).to eq(2)

    code = bbcode_fragment("Paragraph.\n\n    standalone code")
    expect(code.at_css("pre code").text.strip).to eq("standalone code")
  end

  it "retains native Markdown tables" do
    fragment = bbcode_fragment("| Name | Role |\n| --- | --- |\n| Alice | Writer |")

    expect(fragment.css("table th").map(&:text)).to eq(%w[Name Role])
    expect(fragment.css("table td").map(&:text)).to eq(%w[Alice Writer])
  end

  it "uses native inline formatting without changing Markdown paragraphs" do
    fragment =
      bbcode_fragment("First [b]bold[/b] [i]italic[/i].\n\nSecond [u]underlined[/u] [s]struck[/s].")

    expect(fragment.css("p").map(&:text)).to eq(["First bold italic.", "Second underlined struck."])
    expect(fragment.at_css("span.bbcode-b").text).to eq("bold")
    expect(fragment.at_css("span.bbcode-i").text).to eq("italic")
    expect(fragment.at_css("span.bbcode-u").text).to eq("underlined")
    expect(fragment.at_css("span.bbcode-s").text).to eq("struck")
  end

  it "retains native Markdown lists and tables containing core inline BBCode" do
    fragment = bbcode_fragment(<<~MARKDOWN)
        - [b]First[/b]
        - [i]Second[/i]

        | Name | Role |
        | --- | --- |
        | [u]Alice[/u] | [s]Writer[/s] |
      MARKDOWN

    expect(fragment.css("ul > li").map(&:text)).to eq(%w[First Second])
    expect(fragment.at_css("li .bbcode-b").text).to eq("First")
    expect(fragment.css("table th").map(&:text)).to eq(%w[Name Role])
    expect(fragment.at_css("table td .bbcode-u").text).to eq("Alice")
  end

  it "retains native indented code alongside core inline BBCode" do
    fragment = bbcode_fragment("[b]Formatted paragraph[/b]\n\n    [i]Literal example[/i]")

    expect(fragment.at_css("p .bbcode-b").text).to eq("Formatted paragraph")
    expect(fragment.at_css("pre code").text.strip).to eq("[i]Literal example[/i]")
    expect(fragment.css(".bbcode-i")).to be_empty
  end

  it "keeps native Markdown headings inside authored div and nobr wrappers" do
    fragment =
      bbcode_fragment("[div]\n\n# First heading\n\n[/div]\n[nobr]\n\n## Second heading\n\n[/nobr]")

    expect(fragment.at_css("div h1").text).to eq("First heading")
    expect(fragment.at_css("h2").text).to eq("Second heading")
  end

  it "lets authors escape literal hash labels without disabling headings" do
    fragment = bbcode_fragment("[div]\n\n\\# character sheet\n\n# Heading\n\n[/div]")

    expect(fragment.at_css("div").text).to include("# character sheet")
    expect(fragment.css("h1").map(&:text)).to eq(["Heading"])
  end

  it "renders allowed raw HTML and leaves comments hidden beside custom BBCode" do
    fragment = bbcode_fragment(<<~MARKUP)
        [center]Custom content[/center]

        <details><summary>Open details</summary>Visible body</details>
        <!-- Hidden source note -->

        After the details.
      MARKUP

    expect(fragment.at_css("details > summary").text).to eq("Open details")
    expect(fragment.at_css("details").text).to include("Visible body")
    expect(fragment.text).not_to include("<details>", "Hidden source note")
    expect(fragment.at_css(".bb-center").text).to eq("Custom content")
  end

  it "shows HTML and comments literally in plain and code examples" do
    example = "<details><summary>Example</summary>Body</details><!-- source note -->"
    fragment = bbcode_fragment("[plain]#{example}[/plain]\n[code=html]#{example}[/code]")

    expect(fragment.css("details, summary")).to be_empty
    expect(fragment.text).to include(example)
    expect(fragment.at_css("pre code").text.strip).to eq(example)
  end

  it "leaves unsupported XenForo list and table tags literal" do
    example = "[list][*]First[/list]\n[table][tr][td]Cell[/td][/tr][/table]"
    fragment = bbcode_fragment(example)

    expect(fragment.text).to include(
      "[list][*]First[/list]",
      "[table][tr][td]Cell[/td][/tr][/table]",
    )
    expect(fragment.css("ul, ol, table")).to be_empty
  end

  it "renders indented legacy div layouts inside nobr without exposing generated HTML" do
    fragment = bbcode_fragment(<<~BBCODE)
        [div class=outer][nobr]
            [div class=card]
                [div class=inside][b]Character name[/b][/div]
            [/div]
        [/nobr][/div]
      BBCODE

    expect(fragment.at_css("div div div .bbcode-b").text).to eq("Character name")
    expect(fragment.css("pre, code")).to be_empty
    expect(fragment.text).not_to include("<div", "</div>", "[div", "[/div]")
  end

  it "leaves native cooking in control when the plugin is disabled" do
    SiteSetting.bbcode_enabled = false
    fragment = bbcode_fragment("First **paragraph**.\n\n[center]Legacy text[/center]")

    expect(fragment.at_css("strong").text).to eq("paragraph")
    expect(fragment.css("p").size).to eq(2)
    expect(fragment.text).to include("[center]Legacy text[/center]")
    expect(fragment.css(".bb-center")).to be_empty
  end

  it "honors an explicit feature override used by chat cooking" do
    fragment =
      bbcode_fragment(
        "**Chat text**\n\n[center]Legacy text[/center]",
        features_override: %w[bold italics code paragraph],
      )

    expect(fragment.text).to include("[center]Legacy text[/center]")
    expect(fragment.css(".bb-center")).to be_empty
  end

  it "keeps cooked custom content inside Discourse's sanitizer" do
    fragment =
      bbcode_fragment(
        '[spoiler=Example]<img src="https://example.test/a.png" onerror="alert(1)">' \
          "<script>alert(2)</script>[b]Safe text[/b][/spoiler]",
      )

    expect(fragment.at_css("details.bb-spoiler .bbcode-b").text).to eq("Safe text")
    expect(fragment.css("script, [onerror]")).to be_empty
  end
end
