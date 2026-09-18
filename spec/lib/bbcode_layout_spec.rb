# frozen_string_literal: true

RSpec.describe PrettyText do
  before { SiteSetting.bbcode_enabled = true }

  def bbcode_fragment(raw, **options)
    Nokogiri::HTML5.fragment(PrettyText.cook(raw, options))
  end

  it "marks authored divs without marking generated layout wrappers" do
    fragment =
      bbcode_fragment(
        '[div="width: 600px"]Plain layout[/div]' \
          '[div class="card" style="width: 700px"]Class layout[/div]' \
          "[bg=red]Generated background[/bg]",
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
    style =
      "background-image:url('https://example.com/paper.png?version=2&mode=paper'); color:#123456;"
    fragment = bbcode_fragment("[div=#{style}]Character sheet[/div]")

    expect(fragment.at_css("div[data-bbcode-div]")["style"]).to eq(style)
    expect(fragment.text).to eq("Character sheet")
  end
end
