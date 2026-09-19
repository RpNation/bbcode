# frozen_string_literal: true

# Rehosts external images referenced through bbcode-generated CSS (the [class]/
# [animation] style block, and raw style="" attributes from [div]/[tab]/
# [accordion]) the same way core rehosts <img src>: prepend onto
# HotlinkedMedia.extract_candidates so core's own PullHotlinkedImages job
# downloads and books them, then rewrite the cooked doc to point at the local
# upload once downloaded.
module ::BbCode
  module CssHotlinkedMedia
    STYLE_TEMPLATE_SELECTOR = 'template[data-bbcode-plus="class"]'
    URL_FN_REGEX = /url\(\s*(['"]?)([^'")]+)\1\s*\)/i

    # Duck-types just enough of a Nokogiri node to satisfy
    # HotlinkedMedia.download_src_for (node["src"]) and callers that branch on
    # node.name, e.g. plugins/chat's job.
    CandidateNode =
      Struct.new(:url) do
        def [](key)
          url if key == "src"
        end

        def name
          "bbcode-css-url"
        end
      end

    module ExtendExtractCandidates
      def extract_candidates(html)
        doc = html.is_a?(Nokogiri::XML::Node) ? html : Nokogiri::HTML5.fragment(html)
        super(doc).to_a + ::BbCode::CssHotlinkedMedia.extract_candidates(doc)
      end
    end

    # Keeps post.raw in sync the same way core does for img src/href: once a
    # CSS url() has a downloaded PostHotlinkedMedia record, point the raw
    # source at it too (as an upload:// short-url, which rewrite_css above
    # already knows how to resolve back into a real URL on every future cook).
    module RewriteRawCssUrls
      def replace_hotlinked_image_urls(raw:, &blk)
        rewritten = super

        rewritten.gsub(URL_FN_REGEX) do |match|
          quote = Regexp.last_match(1)
          src = Regexp.last_match(2)
          upload = blk.call(src)
          upload ? "url(#{quote}#{upload.short_url}#{quote})" : match
        end
      end
    end

    def self.each_css_node(doc)
      doc.css(STYLE_TEMPLATE_SELECTOR).each { |node| yield node, node.text }
      doc.css("[style]").each { |node| yield node, node["style"] }
    end

    # Remote urls referenced from bbcode CSS in +doc_or_html+, as candidate
    # nodes for ::HotlinkedMedia.extract_candidates to append to its own list.
    def self.extract_candidates(doc_or_html)
      doc =
        doc_or_html.is_a?(Nokogiri::XML::Node) ? doc_or_html : Nokogiri::HTML5.fragment(doc_or_html)

      urls = Set.new
      each_css_node(doc) { |_node, css| css.scan(URL_FN_REGEX) { |_, url| urls << url } }
      urls
        .reject { |url| url.start_with?("upload://") }
        .select { |url| ::HotlinkedMedia.remote_src?(url) }
        .map { |url| CandidateNode.new(url) }
    end

    # Rewrites +doc+ in place: upload:// references resolve unconditionally
    # (the same scheme core resolves for img src/a href), and hotlinked
    # external urls resolve using already-downloaded PostHotlinkedMedia
    # records on +post+. Returns whether anything changed.
    def self.rewrite_doc!(doc, post)
      return false unless doc.at_css("#{STYLE_TEMPLATE_SELECTOR}, [style]")

      hotlinked_map = post.post_hotlinked_media.includes(:upload).index_by(&:url)
      changed = false

      each_css_node(doc) do |node, css|
        new_css = rewrite_css(css, hotlinked_map, post)
        next if new_css == css

        if node.name == "template"
          node.content = new_css
        else
          node["style"] = new_css
        end
        changed = true
      end

      changed
    end

    def self.rewrite_css(css, hotlinked_map, post)
      css.gsub(URL_FN_REGEX) do |match|
        quote = Regexp.last_match(1)
        url = Regexp.last_match(2)
        upload = resolve_upload(url, hotlinked_map)

        if upload
          cooked_url = UrlHelper.cook_url(upload.url, secure: post.should_secure_uploads?)
          "url(#{quote}#{cooked_url}#{quote})"
        else
          match
        end
      end
    end

    # The upload a CSS url() should resolve to: either an upload:// short-url
    # (the same scheme core resolves for img src/a href), or an external url
    # already hotlinked and downloaded onto +post+.
    def self.resolve_upload(url, hotlinked_map)
      if url.start_with?("upload://")
        sha1 = Upload.sha1_from_short_url(url)
        Upload.find_by(sha1: sha1) if sha1.present?
      else
        record = hotlinked_map[PostHotlinkedMedia.normalize_src(url)]
        record.upload if record&.downloaded?
      end
    end
    private_class_method :resolve_upload
  end
end
