# frozen_string_literal: true

RSpec.describe BbCode::Cleanup do
  before do
    SiteSetting.bbcode_enabled = true
    PrettyText.reset_context
  end

  after { PrettyText.reset_context }

  it "cleans up a cooked post in one wrapper, with the same output as without it" do
    html = PrettyText.markdown("[b]a[/b] @someone\nhttps://example.com\n</div> b\n" * 3)
    allow(described_class).to receive(:wrapped).and_call_original
    wrapped = PrettyText.cleanup(html)

    expect(described_class).to have_received(:wrapped)
    SiteSetting.bbcode_enabled = false
    expect(wrapped).to eq(PrettyText.cleanup(html))
  end

  it "runs core's cleanup when the post cooks" do
    allow(described_class).to receive(:wrapped).and_call_original

    expect(PrettyText.cook("a\nb")).to eq("a<br>\nb")
    expect(described_class).to have_received(:wrapped)
  end

  it "cleans up unwrapped when the HTML names the wrapper" do
    html = "a </bbcode-cleanup> b <bbcode-cleanup>c"
    cleaned = PrettyText.cleanup(html)

    SiteSetting.bbcode_enabled = false
    expect(cleaned).to eq(PrettyText.cleanup(html))
  end
end
