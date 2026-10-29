# frozen_string_literal: true

# Makes sure a font file of an imported family is stored on this site, downloading it from Fontsource
# the first time it is needed.
class BbCode::Font::PullFile
  include Service::Base

  params do
    attribute :font_id, :string
    attribute :filename, :string

    validates :font_id, presence: true, format: { with: BbCode::Fontsource::ID_FORMAT }
    validates :filename, presence: true, format: { with: BbCode::Fontsource::FILENAME_FORMAT }
  end

  model :font
  policy :font_uses_file
  lock :font_id, :filename do
    model :upload, :obtain_upload
  end

  private

  def fetch_font(params:)
    BbCode::Font.find_by(font_id: params.font_id)
  end

  def font_uses_file(font:, params:)
    font.filenames.include?(params.filename)
  end

  def obtain_upload(font:, params:)
    font.stored_upload(params.filename) ||
      BbCode::Font::Action::StoreFile.call(font:, filename: params.filename)
  end
end
