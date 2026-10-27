# frozen_string_literal: true

module ::BbCode
  class Font < ActiveRecord::Base
    self.table_name = "bbcode_fonts"

    FILE_URL = %r{url\(/bbcode/fonts/[a-z0-9-]+/(?<filename>[a-z0-9-]+\.woff2)\)}
    MAX_STYLESHEET_BYTES = 1.megabyte
    LAST_USED_REFRESH_INTERVAL = 1.day

    # How long browsers and shared caches may keep a stylesheet, or the redirect to a font file, see
    # `BbCode::FontsController`.
    SERVED_CACHE = {
      stylesheet: {
        browser: 1.hour,
        shared: 1.day,
        stale_while_revalidate: 1.week,
      },
      file: {
        browser: 1.day,
        shared: 1.week,
        stale_while_revalidate: 1.week,
      },
    }.freeze

    # The files of a replaced version stay stored for as long as a cached response can still point at them.
    RETIRED_TARGET_TYPE = "BbCode::RetiredFont"
    RETIRED_UPLOAD_GRACE =
      SERVED_CACHE.values.map { |cache| cache[:shared] + cache[:stale_while_revalidate] }.max +
        1.day

    has_many :upload_references, as: :target, dependent: :delete_all
    has_many :uploads, through: :upload_references

    validates :font_id,
              presence: true,
              uniqueness: true,
              format: {
                with: BbCode::Fontsource::ID_FORMAT,
              }
    validates :family, :checked_at, :last_used_at, presence: true
    validates :version, presence: true, format: { with: BbCode::Fontsource::Client::VERSION_FORMAT }
    validates :css, presence: true, length: { maximum: MAX_STYLESHEET_BYTES }

    scope :idle, -> { where("last_used_at < ?", idle_cutoff) }

    def self.idle_cutoff
      SiteSetting.bbcode_font_evict_idle_days.days.ago
    end

    # Files that were stored for a version that has since been replaced, once nothing can ask for them.
    def self.retired_references_past_grace
      UploadReference.where(target_type: RETIRED_TARGET_TYPE).where(
        "updated_at < ?",
        RETIRED_UPLOAD_GRACE.ago,
      )
    end

    # The id Fontsource gives a family, e.g. "Open Sans" => "open-sans".
    def self.id_for(family_name)
      family_name.to_s.downcase.gsub(/[^a-z0-9]+/, "-").delete_prefix("-").delete_suffix("-")
    end

    def self.upload_target_types
      [polymorphic_name, RETIRED_TARGET_TYPE]
    end

    def self.file_path(font_id, filename)
      "/bbcode/fonts/#{font_id}/#{filename}"
    end

    # At most one write per interval, so serving a font stays read-only the rest of the time.
    def touch_last_used
      stale_before = LAST_USED_REFRESH_INTERVAL.ago
      return if last_used_at >= stale_before

      self
        .class
        .where(id:)
        .where("last_used_at < ?", stale_before)
        .update_all(last_used_at: Time.zone.now)
    end

    def revalidation_due?
      checked_at < SiteSetting.bbcode_font_revalidate_days.days.ago
    end

    def idle?
      last_used_at < self.class.idle_cutoff
    end

    # Every file stored for this font, current or retired.
    def all_upload_references
      UploadReference.where(target_type: self.class.upload_target_types, target_id: id)
    end

    # A new version means the stored files are stale, but pages that cached the previous stylesheet
    # still ask for them, so they are kept (see `RETIRED_UPLOAD_GRACE`) and only no longer served
    # from here: the new stylesheet pulls the files again as they are needed.
    def retire_stored_files
      now = Time.zone.now
      already_retired =
        UploadReference.where(
          target_type: RETIRED_TARGET_TYPE,
          target_id: id,
          upload_id: upload_references.select(:upload_id),
        )

      # a file stored again unchanged since an earlier retirement keeps its single retired link
      already_retired.update_all(updated_at: now)
      upload_references.where(upload_id: already_retired.select(:upload_id)).delete_all
      upload_references.update_all(target_type: RETIRED_TARGET_TYPE, updated_at: now)
    end

    def filenames
      css.scan(FILE_URL).flatten.uniq
    end

    def stored_upload(filename)
      uploads.find_by(original_filename: filename)
    end

    # Font files that are already stored are linked directly, so they are served without
    # going through the app; the others point at the route that fetches them on demand.
    def stylesheet
      stored_urls = uploads.pluck(:original_filename, :url).to_h

      css.gsub(FILE_URL) do
        filename = Regexp.last_match[:filename]
        url =
          if (stored_url = stored_urls[filename])
            UrlHelper.cook_url(stored_url, secure: false)
          else
            Discourse.base_path + self.class.file_path(font_id, filename)
          end
        "url(#{url})"
      end
    end
  end
end

# == Schema Information
#
# Table name: bbcode_fonts
#
#  id           :bigint           not null, primary key
#  checked_at   :datetime         not null
#  css          :text             not null
#  family       :string           not null
#  last_used_at :datetime         not null
#  version      :string           not null
#  created_at   :datetime         not null
#  updated_at   :datetime         not null
#  font_id      :string           not null
#
# Indexes
#
#  index_bbcode_fonts_on_font_id       (font_id) UNIQUE
#  index_bbcode_fonts_on_last_used_at  (last_used_at)
#
