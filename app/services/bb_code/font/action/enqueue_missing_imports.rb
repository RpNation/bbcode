# frozen_string_literal: true

class BbCode::Font::Action::EnqueueMissingImports < Service::ActionBase
  MAX_FONTS_PER_POST = 10

  option :cooked

  def call
    return if requested_font_ids.empty?

    font_ids = requested_font_ids - BbCode::Font.where(font_id: requested_font_ids).pluck(:font_id)
    return if font_ids.empty?

    listed = BbCode::Fontsource::FontList.ids
    return if listed.nil?

    font_ids
      .select { |font_id| listed.include?(font_id) }
      .each do |font_id|
        BbCode::Font::Action::EnqueueOnce.call(job: Jobs::BbCode::ImportFont, font_id:)
      end
  end

  private

  def requested_font_ids
    @requested_font_ids ||=
      cooked
        .css("[data-font]")
        .filter_map { |element| BbCode::Font.id_for(element["data-font"]).presence }
        .uniq
        .first(MAX_FONTS_PER_POST)
  end
end
