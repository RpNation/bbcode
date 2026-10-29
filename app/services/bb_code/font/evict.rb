# frozen_string_literal: true

# Deletes a font nobody has used for a long time (or any font, when forced), together with every file
# stored for it. It is imported and downloaded again if it is ever needed later.
class BbCode::Font::Evict
  include Service::Base

  params do
    attribute :font_id, :string

    validates :font_id, presence: true, format: { with: BbCode::Fontsource::ID_FORMAT }
  end

  options { attribute :force, :boolean, default: false }

  model :font
  policy :idle_for_too_long
  lock :font_id do
    step :destroy_stored_files
    step :delete_font
  end

  private

  def fetch_font(params:)
    BbCode::Font.select(:id, :font_id, :last_used_at).find_by(font_id: params.font_id)
  end

  def idle_for_too_long(font:, options:)
    options.force || font.idle?
  end

  def destroy_stored_files(font:)
    BbCode::Font::Action::DestroyUploads.call(references: font.all_upload_references)
  end

  def delete_font(font:)
    font.destroy!
  end
end
