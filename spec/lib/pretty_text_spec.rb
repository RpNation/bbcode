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
      bbcode_fragment(
        "[b]Outside[/b] prefix ``one ` two`` suffix `alpha\n[b]literal[/b]\nbeta`",
      )

    expect(fragment.css("code").size).to eq(2)
    expect(fragment.css("code").first.text).to eq("one ` two")
    expect(fragment.css("code").last.text).to include("alpha", "[b]literal[/b]", "beta")
    expect(fragment.css(".bbcode-b").map(&:text)).to eq(["Outside"])
  end

  it "shows HTML examples as text inside BBCode and Markdown code blocks" do
    example = '<div class="example">A & B</div>'
    fragment =
      bbcode_fragment(
        "[code=html]#{example}[/code]\n\n```html\n#{example}\n```\n\n`#{example}`",
      )

    expect(fragment.css("code").map(&:text).map(&:strip)).to eq([example, example, example])
    expect(fragment.css("code div, .example")).to be_empty
  end

  it "retains Markdown paragraphs when BBCode appears only inside a fenced example" do
    example = "[spoiler=Example]Hidden text[/spoiler]"
    fragment =
      bbcode_fragment(
        "First **paragraph**.\n\n```bbcode\n#{example}\n```\n\nSecond paragraph.",
      )

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
    fragment =
      bbcode_fragment(<<~MARKDOWN)
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
    fragment =
      bbcode_fragment(<<~BBCODE)
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
    fragment =
      bbcode_fragment(<<~MARKDOWN)
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

  it "renders guide-style BBCode table headers, cells, footers and column spans" do
    fragment =
      bbcode_fragment(<<~BBCODE)
        [table]
        [tr][th=2]Characters[/th][/tr]
        [tr][td][b]Name[/b][/td][td][spoiler=History]Story[/spoiler][/td][/tr]
        [tr][tf=2]Footer note[/tf][/tr]
        [/table]
      BBCODE
    table = fragment.at_css("table.bb-table")

    expect(table.css("tr").size).to eq(3)
    expect(table.at_css("th")["colspan"]).to eq("2")
    expect(table.at_css("th").text).to eq("Characters")
    expect(table.at_css("td .bbcode-b").text).to eq("Name")
    expect(table.at_css("td details.bb-spoiler .bb-spoiler-content").text).to eq("Story")
    expect(table.at_css("td.bb-table-footer")["colspan"]).to eq("2")
    expect(table.at_css("td.bb-table-footer").text).to eq("Footer note")
  end

  it "preserves independent nested BBCode tables" do
    fragment =
      bbcode_fragment(
        "[table][tr][td]Outer [table][tr][td]Inner[/td][/tr][/table][/td][/tr][/table]",
      )

    expect(fragment.css("table.bb-table").size).to eq(2)
    expect(fragment.at_css("table.bb-table td table.bb-table td").text).to eq("Inner")
    expect(fragment.at_css("table.bb-table > tbody > tr > td").text).to include("Outer")
  end

  it "keeps supported XenForo table appearance choices through sanitization" do
    styles = %w[none dotted-zebra dark-zebra2]
    fragment =
      bbcode_fragment(
        styles.map { |style| "[table=#{style}][tr][td]Cell[/td][/tr][/table]" }.join("\n"),
      )

    expect(fragment.css("table.bb-table").map { |table| table["data-bb-table-style"] }).to eq(
      styles,
    )
  end

  it "keeps legacy table row highlights and normalizes grey to gray" do
    fragment =
      bbcode_fragment(
        "[table][tr=blue][td]Blue[/td][/tr][tr=grey][td]Gray[/td][/tr][/table]",
      )

    expect(fragment.css("tr").map { |row| row["data-bb-table-row"] }).to eq(%w[blue gray])
  end

  it "ignores invalid table styling and out-of-range column spans" do
    spans = %w[0 -1 1001 2px]
    cells = spans.map { |span| "[td=#{span}]Cell[/td]" }.join
    fragment = bbcode_fragment("[table=position:fixed][tr=red]#{cells}[/tr][/table]")

    expect(fragment.at_css("table.bb-table").key?("data-bb-table-style")).to eq(false)
    expect(fragment.at_css("tr").key?("data-bb-table-row")).to eq(false)
    expect(fragment.css("td").size).to eq(4)
    expect(fragment.css("[colspan], [style]")).to be_empty
  end

  it "preserves orphan table tags as text instead of dropping their content" do
    fragment = bbcode_fragment("[td]Orphan cell[/td]\n[tr][th]Orphan header[/th][/tr]")

    expect(fragment.text).to include("[td]Orphan cell[/td]", "Orphan header")
    expect(fragment.css("table, tr, td, th")).to be_empty
  end

  it "preserves unexpected text around the rows of a legacy table" do
    fragment =
      bbcode_fragment("[table]Caption text[tr][td]Cell text[/td][/tr]Trailing text[/table]")

    expect(fragment.text).to include("Caption text", "Cell text", "Trailing text")
    expect(fragment.css("table, tr, td")).to be_empty
  end

  it "preserves unexpected text around the cells of a legacy table row" do
    fragment =
      bbcode_fragment("[table][tr]Before cell[td]Cell text[/td]After cell[/tr][/table]")

    expect(fragment.text).to include("Before cell", "Cell text", "After cell")
    expect(fragment.css("table, tr, td")).to be_empty
  end

  it "keeps table source examples literal in the guide's code blocks" do
    example = "[table][tr][td]Example[/td][/tr][/table]"
    fragment = bbcode_fragment("[code]#{example}[/code]")

    expect(fragment.at_css("pre code").text.strip).to eq(example)
    expect(fragment.css("table")).to be_empty
  end

  it "renders XenForo list separators with nested formatting" do
    fragment = bbcode_fragment("[list][*]First item[*][b]Second item[/b][/list]")
    items = fragment.css("ul > li")

    expect(items.map(&:text)).to eq(["First item", "Second item"])
    expect(items.last.at_css(".bbcode-b").text).to eq("Second item")
    expect(fragment.text).not_to include("[*]")
  end

  it "keeps a nested list inside its outer item" do
    fragment =
      bbcode_fragment(
        "[list][*]First [list][*]Nested item[/list][*]Second item[/list]",
      )
    outer = fragment.at_css("ul")
    outer_items = outer.element_children.select { |child| child.name == "li" }

    expect(outer_items.size).to eq(2)
    expect(outer_items.first.at_css("ul > li").text).to eq("Nested item")
    expect(outer_items.last.text).to eq("Second item")
    expect(outer_items.last.css("ul")).to be_empty
  end

  it "accepts quoted ordered and unordered legacy list options" do
    fragment =
      bbcode_fragment(
        "[LIST='1'][*]Ordered[/LIST]\n[LIST='*'][*]Unordered[/LIST]",
      )

    expect(fragment.css("ol > li").map(&:text)).to eq(["Ordered"])
    expect(fragment.css("ul > li").map(&:text)).to eq(["Unordered"])
  end

  it "renders lists inside layout and nobr wrappers used by design posts" do
    fragment =
      bbcode_fragment(
        "[div class=card][nobr][LIST][*]One[*][i]Two[/i][/LIST][/nobr][/div]",
      )

    expect(fragment.css("div ul > li").map(&:text)).to eq(%w[One Two])
    expect(fragment.at_css("div ul > li .bbcode-i").text).to eq("Two")
    expect(fragment.text).not_to include("[LIST]", "[*]")
  end

  it "renders indented legacy div layouts inside nobr without exposing generated HTML" do
    fragment =
      bbcode_fragment(<<~BBCODE)
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

  it "keeps the Midnight card's tiny hash labels literal inside a nobr layout" do
    fragment =
      bbcode_fragment(<<~BBCODE)
        [nobr]
        [div=position:relative; width:390px; height:250px;]
        [div=position:absolute; top:205px; left:50px; width:120px; text-align:right; font-size:7px; line-height:7px;]

        # character sheet
        [br][/br]
        # mobile friendly

        [/div]
        [/div]
        [/nobr]
      BBCODE
    label = fragment.css("div[data-bbcode-div]").find { |div| div["style"].include?("font-size:7px") }

    expect(label).to be_present
    expect(label["style"]).to include("font-size:7px", "line-height:7px")
    expect(label.text).to include("# character sheet", "# mobile friendly")
    expect(label.at_css("br")).to be_present
    expect(fragment.css("h1, h2, h3, h4, h5, h6")).to be_empty
  end

  it "keeps hash labels literal inside authored divs without a nobr wrapper" do
    fragment =
      bbcode_fragment(<<~BBCODE)
        [div=font-size:7px;]

        # character sheet

        ## mobile friendly

        [/div]
      BBCODE

    expect(fragment.at_css("div[data-bbcode-div]").text).to include(
      "# character sheet",
      "## mobile friendly",
    )
    expect(fragment.css("h1, h2")).to be_empty
  end

  it "retains native headings outside legacy layouts and formatting and links inside them" do
    fragment =
      bbcode_fragment(<<~BBCODE)
        # Before the card

        [nobr][div=font-size:7px;]

        # character sheet
        [br][/br]
        [b]Midnight[/b] [url=https://example.com/character]Open character[/url]

        [/div][/nobr]

        # After the card
      BBCODE
    card = fragment.at_css("div[data-bbcode-div]")

    expect(fragment.css("h1").map(&:text)).to eq(["Before the card", "After the card"])
    expect(card.text).to include("# character sheet")
    expect(card.css("h1")).to be_empty
    expect(card.at_css(".bbcode-b").text).to eq("Midnight")
    expect(card.at_css('a[href="https://example.com/character"]').text).to eq("Open character")
  end

  it "keeps quoted legacy card labels literal while retaining the native quote" do
    fragment =
      bbcode_fragment(<<~BBCODE)
        [quote="Original author"]
        [nobr][div=font-size:7px;]

        # character sheet
        [br][/br]
        # mobile friendly

        [/div][/nobr]
        [/quote]
      BBCODE
    quote = fragment.at_css("aside.quote")

    expect(quote).to be_present
    expect(quote.at_css("div[data-bbcode-div]").text).to include(
      "# character sheet",
      "# mobile friendly",
    )
    expect(quote.css("h1")).to be_empty
  end

  it "keeps hash labels literal in a standalone nobr wrapper" do
    fragment = bbcode_fragment("[nobr]\n\n# character sheet\n\n[/nobr]")

    expect(fragment.text).to include("# character sheet")
    expect(fragment.css("h1")).to be_empty
    expect(fragment.text).not_to include("[nobr]", "[/nobr]")
  end

  it "keeps hash labels literal when the line ends with a Markdown link" do
    fragment =
      bbcode_fragment("[div]\n# [character sheet](https://example.com/character)\n[/div]")

    expect(fragment.css("h1")).to be_empty
    expect(fragment.at_css("div[data-bbcode-div]").text).to include("# character sheet")
    expect(fragment.at_css('a[href="https://example.com/character"]').text).to eq("character sheet")
  end

  it "preserves indented CRLF hash labels nested inside BBCode formatting" do
    fragment =
      bbcode_fragment(
        "[div=font-size:7px;]\r\n\r\n  # character sheet\r\n\r\n" \
          "[b]\r\n   ## mobile friendly\r\n[/b]\r\n\r\n[/div]",
      )
    card = fragment.at_css("div[data-bbcode-div]")

    expect(card.text).to include("# character sheet")
    expect(card.at_css(".bbcode-b").text).to include("## mobile friendly")
    expect(fragment.css("h1, h2, pre")).to be_empty
  end

  it "retains deliberate BBCode headings inside a layout with literal hash labels" do
    fragment =
      bbcode_fragment(<<~BBCODE)
        [div=font-size:7px;]
        [h1]Deliberate heading[/h1]

        # character sheet

        [/div]
      BBCODE
    card = fragment.at_css("div[data-bbcode-div]")

    expect(card.css("h1").map(&:text)).to eq(["Deliberate heading"])
    expect(card.text).to include("# character sheet")
  end

  it "preserves BBCode and Markdown code examples inside a legacy layout" do
    example = "# character sheet\n[b]Literal example[/b]"
    fragment =
      bbcode_fragment(
        "[div=font-size:7px;]\n\n[code]#{example}[/code]\n\n" \
          "```bbcode\n#{example}\n```\n\n`# inline label`\n\n[/div]",
      )
    card = fragment.at_css("div[data-bbcode-div]")

    expect(card.css("pre code").map(&:text).map(&:strip)).to eq([example, example])
    expect(card.css("code").last.text).to eq("# inline label")
    expect(fragment.css("h1, .bbcode-b")).to be_empty
  end

  it "preserves CSS hex colors and URL fragments while protecting layout hash labels" do
    fragment =
      bbcode_fragment(<<~BBCODE)
        [div=color:#bf7043; background-color:#000000;]

        # character sheet
        [url=https://example.com/character#details]Open details[/url]

        [/div]
      BBCODE
    card = fragment.at_css("div[data-bbcode-div]")

    expect(card["style"]).to include("color:#bf7043", "background-color:#000000")
    expect(card.at_css("a")["href"]).to eq("https://example.com/character#details")
    expect(card.at_css("a").text).to eq("Open details")
    expect(card.text).to include("# character sheet")
    expect(card.css("h1")).to be_empty
  end

  it "keeps list source and item markers literal in code examples" do
    example = "[LIST='1'][*]First[*][b]Second[/b][/LIST]"
    fragment = bbcode_fragment("[code]#{example}[/code]\n\n```bbcode\n#{example}\n```")

    expect(fragment.css("pre code").map(&:text).map(&:strip)).to eq([example, example])
    expect(fragment.css("ul, ol, li, .bbcode-b")).to be_empty
  end

  it "does not lose a design post when several nested layout tags are left open" do
    fragment =
      bbcode_fragment(
        "[div class=card][nobr][div class=inner][nobr]Before [b]bold[/b] after[/nobr][/div]",
      )

    expect(fragment.text).to include("Before", "bold", "after")
    expect(fragment.at_css(".bbcode-b").text).to eq("bold")
  end

  it "preserves content after an outer layout tag closes before its inner tag" do
    fragment =
      bbcode_fragment(
        "[div class=card][nobr]Before [b]bold[/b][/div]After outer close",
      )

    expect(fragment.text).to include("Before", "bold", "After outer close")
    expect(fragment.at_css(".bbcode-b").text).to eq("bold")
  end

  it "retains trailing content after a closed child inside an unclosed parent" do
    fragment =
      bbcode_fragment(
        "[div class=card]Start [div class=inner]Middle[/div] End",
      )

    expect(fragment.text).to include("Start", "Middle", "End")
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
          '<script>alert(2)</script>[b]Safe text[/b][/spoiler]',
      )

    expect(fragment.at_css("details.bb-spoiler .bbcode-b").text).to eq("Safe text")
    expect(fragment.css("script, [onerror]")).to be_empty
  end

  it "marks authored divs without marking generated layout wrappers" do
    fragment =
      bbcode_fragment(
        '[div="width: 600px"]Plain layout[/div]' \
          '[div class="card" style="width: 700px"]Class layout[/div]' \
          '[bg=red]Generated background[/bg]',
      )

    authored = fragment.css('div[data-bbcode-div="true"]')
    expect(authored.map(&:text)).to eq(["Plain layout", "Class layout"])
    expect(authored.last["class"]).to start_with("card__post-")
    expect(fragment.at_css(".bb-background").key?("data-bbcode-div")).to eq(false)
  end

  { "unquoted" => "", "single-quoted" => "'", "double-quoted" => '"' }.each do |name, quote|
    it "preserves a #{name} default div style and its child variable references" do
      style = "--paper: #e8e8e8; width: 320px;"
      fragment =
        bbcode_fragment(
          "[div=#{quote}#{style}#{quote}]" \
            "[div=background:var(--paper);]Character sheet[/div][/div]",
        )
      outer = fragment.at_css("div[data-bbcode-div]")
      child = outer.at_css("div[data-bbcode-div]")

      expect(outer["style"]).to eq(style)
      expect(child["style"]).to eq("background:var(--paper);")
      expect(child.text).to eq("Character sheet")
    end
  end

  it "preserves quoted font families and URLs inside a default div style" do
    style = "font-family: 'Ubuntu Mono'; background-image: url('https://example.com/paper.png');"
    fragment = bbcode_fragment("[div=\"#{style}\"]Character sheet[/div]")

    expect(fragment.at_css("div[data-bbcode-div]")["style"]).to eq(style)
  end

  it "preserves keyed div attributes alongside quoted CSS values" do
    style = "--paper: #e8e8e8; font-family: 'Ubuntu Mono';"
    fragment =
      bbcode_fragment(
        "[div class=\"card\" style=\"#{style}\"]" \
          "[div=background:var(--paper);]Character sheet[/div][/div]",
      )
    outer = fragment.at_css("div[data-bbcode-div]")

    expect(outer["class"]).to start_with("card__post-")
    expect(outer["style"]).to eq(style)
    expect(outer.at_css("div[data-bbcode-div]")["style"]).to eq("background:var(--paper);")
  end

  it "preserves equals signs inside a default div CSS URL" do
    style = "background-image:url('https://example.com/paper.png?version=2&mode=paper'); color:#123456;"
    fragment = bbcode_fragment("[div=#{style}]Character sheet[/div]")

    expect(fragment.at_css("div[data-bbcode-div]")["style"]).to eq(style)
    expect(fragment.text).to eq("Character sheet")
  end
end
