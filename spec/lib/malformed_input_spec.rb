# frozen_string_literal: true

# Posts may be 500,000 characters. Each of these once scanned the rest of the
# text per tag, which at this size ran past the 25s JavaScript timeout; linear,
# each cooks in well under a second.
RSpec.describe PrettyText do
  before do
    SiteSetting.bbcode_enabled = true
    PrettyText.reset_context
  end

  after { PrettyText.reset_context }

  def repeated(unit, tail = "")
    unit * ((500_000 - tail.size) / unit.size) + tail
  end

  it "cooks 500,000 characters of unclosed or unterminated tags within the timeout" do
    inputs = {
      "unclosed core inline tags" => repeated("[code]x[url]x[img]x[email]x[wrap=a]x"),
      "unclosed code on separate lines" => repeated("[code]x\n"),
      "unterminated url openers" => repeated("[url="),
      "unclosed literal tags" => repeated("[plain]x[icode]x[comment]x[fa]x"),
      "unterminated openers before one bracket" => repeated("[div=a ", "]"),
      "quoted openers whose close a code span hides" => repeated("> [div]\n", "> `[/div]`"),
    }

    inputs.each { |name, raw| expect { PrettyText.markdown(raw) }.not_to raise_error, name }
  end

  it "leaves an unclosed tag as written wherever it appears, math included" do
    SiteSetting.discourse_math_enabled = true
    PrettyText.reset_context

    expect(PrettyText.cook("$[img]x$ `[url]y` [code]z")).to eq(
      %(<span class="math">[img]x</span> <code>[url]y</code> [code]z),
    )
  end
end
