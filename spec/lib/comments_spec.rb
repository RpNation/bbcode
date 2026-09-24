# frozen_string_literal: true

RSpec.describe BbCode::Comments do
  before do
    SiteSetting.bbcode_enabled = true
    PrettyText.reset_context
  end

  after { PrettyText.reset_context }

  it "cooks a comment to a template, which the post's cook turns into an HTML comment" do
    raw = "a [comment]note --> <b>y</b> & \"q\"[/comment] b"

    expect(PrettyText.cook(raw)).to include("<template data-bbcode-comment")
    expect(Fabricate(:post, raw:).cooked).to eq(
      "a <!--note --&gt; &lt;b&gt;y&lt;/b&gt; &amp; &quot;q&quot;--> b",
    )
  end

  it "leaves cooked HTML without comments untouched" do
    cooked = %(<p>a <template data-bbcode-plus="class">.x{}</template></p>)

    expect(described_class.restore(cooked)).to equal(cooked)
  end
end
