# frozen_string_literal: true

# Other rules and plugins act on a post after it is cooked: they create
# records, notify people, edit it by position, or rewrite it for emails. These
# create real posts with those features inside bbcode tags. The recook
# snapshots show the HTML; this shows the features still work.
RSpec.describe "Other features inside bbcode tags" do
  fab!(:user) { Fabricate(:user, refresh_auto_groups: true) }
  fab!(:other_user) { Fabricate(:user, username: "other_user", refresh_auto_groups: true) }

  before do
    SiteSetting.bbcode_enabled = true
    PrettyText.reset_context
    Jobs.run_immediately!
    # post processing fetches link titles and avatar sizes
    stub_request(:any, %r{\Ahttps?://(example\.com|test\.localhost)/}).to_return(
      status: 200,
      body: "",
    )
  end

  after { PrettyText.reset_context }

  def create_post(raw, topic_id: nil, author: user)
    title = "A topic with bbcode in it #{SecureRandom.alphanumeric(8)}"
    PostCreator.create!(author, raw:, topic_id:, title:)
  end

  describe "polls" do
    it "creates a poll inside a layout tag, with bbcode in its options, that takes votes" do
      post = create_post("[center]\n[poll]\n* [b]one[/b]\n* two\n[/poll]\n[/center]")
      poll = Poll.find_by(post:)

      expect(poll.poll_options.map(&:html)).to eq([%(<span class="bbcode-b">one</span>), "two"])

      DiscoursePoll::Poll.vote(other_user, post.id, "poll", [poll.poll_options.first.digest])

      expect(poll.poll_votes.pluck(:user_id)).to eq([other_user.id])
    end

    it "creates every poll in a tabbed post, each under its own name" do
      post =
        create_post(
          "[tabs]\n[tab=Day 1]\n[poll name=day1]\n* yes\n* no\n[/poll]\n[/tab]\n" \
            "[tab=Day 2]\n[poll name=day2]\n* stay\n* go\n[/poll]\n[/tab]\n[/tabs]",
        )

      expect(Poll.where(post:).pluck(:name)).to contain_exactly("day1", "day2")
    end
  end

  describe "checklists" do
    def checkbox_toggled(raw, index)
      post = create_post(raw)
      boxes = Nokogiri::HTML5.fragment(post.cooked).css("span.chcklst-box")
      result =
        Checklist::ToggleCheckbox.call(
          guardian: user.guardian,
          params: {
            post_id: post.id,
            toggles: [
              {
                checkbox_index: index,
                checkbox_count: boxes.size,
                checkbox_source: boxes[index]&.[]("data-chk-src"),
                checked: true,
              },
            ],
            expected_raw: post.raw,
            expected_updated_at: post.updated_at.iso8601(3),
            mutation_id: SecureRandom.hex,
          },
        )
      expect(result).to be_a_success
      post.reload.raw
    end

    it "toggles the box clicked when the boxes are inside a block tag" do
      expect(checkbox_toggled("intro\n[center]\n[ ] one\n[ ] two\n[/center]", 1)).to eq(
        "intro\n[center]\n[ ] one\n[x] two\n[/center]",
      )
    end

    it "toggles the box clicked when a block tag comes first" do
      expect(checkbox_toggled("[center]\nx\n\ny\n[/center]\n[ ] one\n[ ] two", 1)).to eq(
        "[center]\nx\n\ny\n[/center]\n[ ] one\n[x] two",
      )
    end

    it "toggles the box clicked after an inline tag spanning lines" do
      expect(checkbox_toggled("[b]a\nb[/b]\n[ ] one\n[ ] two", 1)).to eq(
        "[b]a\nb[/b]\n[ ] one\n[x] two",
      )
    end

    it "toggles the box clicked two tags deep" do
      raw = "[center]\n[spoiler=Tasks]\n[ ] one\n[ ] two\n[/spoiler]\n[/center]"

      expect(checkbox_toggled(raw, 1)).to eq(raw.sub("[ ] two", "[x] two"))
    end

    it "leaves a box inside an inline tag as text, as inside Markdown emphasis" do
      post = create_post("[b][ ] one[/b] **[ ] two** [ ] three")

      expect(Nokogiri::HTML5.fragment(post.cooked).css("span.chcklst-box").size).to eq(1)
    end

    it "toggles the box clicked after a block tag that starts mid-line" do
      expect(checkbox_toggled("text [center]a\nb[/center]\n[ ] one\n[ ] two", 1)).to eq(
        "text [center]a\nb[/center]\n[ ] one\n[x] two",
      )
    end

    it "toggles the first box, not the next one, after a block tag that starts mid-line" do
      expect(checkbox_toggled("text [center]a\nb[/center]\n[ ] one\n[ ] two", 0)).to eq(
        "text [center]a\nb[/center]\n[x] one\n[ ] two",
      )
    end

    it "toggles the box clicked inside a block tag in a blockquote" do
      expect(checkbox_toggled("> [center]\n> [ ] one\n> [ ] two\n> [/center]", 1)).to eq(
        "> [center]\n> [ ] one\n> [x] two\n> [/center]",
      )
    end

    it "toggles the box clicked in a to-do list inside a spoiler" do
      expect(checkbox_toggled("[spoiler=Tasks]\n[ ] pack\n[ ] leave\n[/spoiler]", 1)).to eq(
        "[spoiler=Tasks]\n[ ] pack\n[x] leave\n[/spoiler]",
      )
    end

    it "skips a box shown as plain text" do
      expect(checkbox_toggled("[plain][ ][/plain] shown\n[ ] one", 0)).to eq(
        "[plain][ ][/plain] shown\n[x] one",
      )
    end
  end

  describe "oneboxes" do
    let(:url) { "https://example.com/story" }

    before do
      stub_request(:any, url).to_return(
        status: 200,
        body:
          "<html><head><meta property='og:title' content='A story'>" \
            "<meta property='og:description' content='About it'></head></html>",
      )
    end

    it "oneboxes a URL on its own line inside a block tag, as at the top level" do
      post = create_post("[center]\n#{url}\n[/center]\n[spoiler=Link]\n#{url}\n[/spoiler]")
      doc = Nokogiri::HTML5.fragment(post.reload.cooked)

      expect(doc.css("div.bb-center aside.onebox, div.bb-spoiler-content aside.onebox").size).to eq(
        2,
      )
    end

    it "keeps a URL inline when it shares its line with text or a tag, or is in a Markdown quote" do
      post =
        create_post(
          "[center]\nread #{url}\n[/center]\n[center]#{url}[/center]\n\n> [center]\n> #{url}\n> [/center]",
        )

      expect(Nokogiri::HTML5.fragment(post.reload.cooked).css("aside.onebox")).to be_empty
    end
  end

  describe "details" do
    it "reduces details inside a bbcode tag to a link in emails" do
      post = create_post("[center]\n[details=Summary]\nsecret [b]text[/b]\n[/details]\n[/center]")
      email = PrettyText.format_for_email(post.cooked, post)

      expect(email).to include("Summary", I18n.t("details.excerpt_details"))
      expect(email).not_to include("secret")
    end
  end

  describe "footnotes" do
    it "links each footnote reference inside a tag to its footnote" do
      post =
        create_post("[b]claim[^1][/b] and [center]another[^2][/center]\n\n[^1]: one\n[^2]: two")
      doc = Nokogiri::HTML5.fragment(post.cooked)
      targets = doc.css("sup.footnote-ref a").map { |link| link["href"].delete_prefix("#") }

      expect(targets.size).to eq(2)
      expect(targets).to all(satisfy { |id| doc.at_css("[id='#{id}']") })
    end
  end

  describe "emoji" do
    it "turns shortcodes and unicode emoji into images inside tags, but not in plain text" do
      post = create_post("[center]:smile: 😀[/center] [plain]:smile: 😀[/plain]")
      emoji = Nokogiri::HTML5.fragment(post.cooked).css("img.emoji").map { |img| img["title"] }

      expect(emoji).to eq(%w[:smile: :grinning_face:])
      expect(post.cooked).to include(":smile: 😀</div>").or include(":smile: 😀")
    end
  end

  describe "quotes" do
    it "records and notifies a quote inside a tag, with the quoted user's avatar" do
      quoted = create_post("original words", author: other_user)
      reply =
        create_post(
          "[center]\n[quote=\"other_user, post:1, topic:#{quoted.topic_id}\"]\noriginal words\n[/quote]\n[/center]",
        )

      expect(QuotedPost.where(post_id: reply.id).pluck(:quoted_post_id)).to eq([quoted.id])
      expect(Nokogiri::HTML5.fragment(reply.cooked).at_css("aside.quote img.avatar")).to be_present
      expect(
        Notification.where(user: other_user, notification_type: Notification.types[:quoted]),
      ).to exist
    end
  end

  describe "mentions" do
    it "notifies a user mentioned in a character sheet's accordion" do
      create_post("[accordion]\n[slide=Allies]\nFriends with @other_user\n[/slide]\n[/accordion]")

      expect(
        Notification.where(user: other_user, notification_type: Notification.types[:mentioned]),
      ).to exist
    end

    it "notifies a user mentioned inside a tag, but not one shown as literal text" do
      fab_literal = Fabricate(:user, username: "literal_user")
      create_post("[center]hi @other_user[/center] [plain]@literal_user[/plain]")

      mentioned = Notification.where(notification_type: Notification.types[:mentioned])
      expect(mentioned.pluck(:user_id)).to eq([other_user.id])
      expect(mentioned.where(user: fab_literal)).not_to exist
    end
  end

  describe "links" do
    it "records the links inside tags, but not a URL shown as literal text" do
      post =
        create_post(
          "[b]https://example.com/bold[/b] [url=https://example.com/url]x[/url] " \
            "[center][text](https://example.com/md)[/center] [plain]https://example.com/plain[/plain]",
        )

      expect(TopicLink.where(post:).pluck(:url)).to contain_exactly(
        "https://example.com/bold",
        "https://example.com/url",
        "https://example.com/md",
      )
    end
  end

  describe "hashtags" do
    fab!(:category) { Fabricate(:category, slug: "rp-lounge") }

    it "links a category hashtag inside a tag" do
      post = create_post("[b]see #rp-lounge[/b]")

      expect(Nokogiri::HTML5.fragment(post.cooked).at_css("a.hashtag-cooked")["href"]).to eq(
        category.url,
      )
    end
  end

  describe "uploads" do
    fab!(:upload) { Fabricate(:image_upload, user:) }

    it "references an upload shown inside a tag" do
      post = create_post("[center]![image|100x100](#{upload.short_url})[/center]")

      expect(UploadReference.where(target: post).pluck(:upload_id)).to eq([upload.id])
    end
  end

  describe "local dates" do
    it "records a date written inside a tag" do
      post = create_post(%([b][date=2030-01-02 time=10:00:00 timezone="UTC"][/b]))

      expect(post.reload.local_dates.map { |date| date["date"] }).to eq(["2030-01-02"])
    end
  end
end
