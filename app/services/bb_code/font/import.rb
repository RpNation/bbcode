# frozen_string_literal: true

# Imports a Google font family from Fontsource: the stylesheet is generated right away, while the
# font files themselves are only downloaded once a browser asks for them, see `BbCode::Font::PullFile`.
class BbCode::Font::Import
  include Service::Base

  params do
    attribute :font_id, :string

    validates :font_id, presence: true, format: { with: BbCode::Fontsource::ID_FORMAT }
  end

  policy :listed_google_family
  only_if :not_imported_yet do
    model :family, :fetch_family
    lock :font_id do
      model :font, :create_font
    end
  end

  private

  def listed_google_family(params:)
    BbCode::Fontsource::FontList.ids&.include?(params.font_id)
  end

  def not_imported_yet(params:)
    !BbCode::Font.exists?(font_id: params.font_id)
  end

  def fetch_family(params:)
    BbCode::Fontsource::Family.fetch(params.font_id)
  end

  def create_font(params:, family:)
    BbCode::Font.find_or_create_by(font_id: params.font_id) do |font|
      font.family = family.name
      font.version = family.version
      font.css = BbCode::Font::Action::BuildStylesheet.call(family:)
      font.checked_at = font.last_used_at = Time.zone.now
    end
  end
end
