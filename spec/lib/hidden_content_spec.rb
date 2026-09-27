# frozen_string_literal: true

RSpec.describe BbCode::HiddenContent do
  let(:css) { "outline: 6px solid magenta" }
  let(:script) { "show secretbox" }
  let(:inline_secret) { "inline secret" }
  let(:block_secret) { "block secret" }
  let(:raw) { <<~RAW }
      intro [spoiler=Title]#{block_secret}[/spoiler] mid [inlinespoiler]#{inline_secret}[/inlinespoiler] end
      [class name=box]
      #{css};
      [/class]
      [script class=box on=click]
      #{script}
      [/script]
    RAW

  before do
    SiteSetting.bbcode_enabled = true
    PrettyText.reset_context
  end

  after { PrettyText.reset_context }

  it "keeps templates and spoilers out of excerpts" do
    excerpt = PrettyText.excerpt(PrettyText.cook(raw), 500)

    expect(excerpt).to include("intro", "Spoiler: Title", "mid", "end")
    expect(excerpt).not_to include(css, script, inline_secret, block_secret)
  end

  it "keeps templates and spoilers out of emails, linking to the post instead" do
    post = Fabricate(:post, raw: raw)

    email = PrettyText.format_for_email(post.cooked, post)

    expect(email).to include("intro", "Title", %(<a href="#{post.full_url}">spoiler</a>))
    expect(email).not_to include(css, script, inline_secret, block_secret)
  end

  it "keeps templates out of the search index and spoilers in it" do
    SearchIndexer.enable
    post = Fabricate(:post, raw: raw)

    search_data = post.post_search_data.raw_data

    expect(search_data).to include(inline_secret, block_secret)
    expect(search_data).not_to include(css.split.last, script.split.last)
  end
end
