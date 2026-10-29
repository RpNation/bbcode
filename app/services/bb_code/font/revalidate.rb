# frozen_string_literal: true

# Checks a stored font against the version Fontsource publishes, once it is due (or when forced).
# The current version keeps being served until this succeeds; when there is a new one, the stored
# files are retired and the stylesheet is generated again.
class BbCode::Font::Revalidate
  include Service::Base

  params do
    attribute :font_id, :string

    validates :font_id, presence: true, format: { with: BbCode::Fontsource::ID_FORMAT }
  end

  options { attribute :force, :boolean, default: false }

  model :font
  policy :due_for_revalidation
  model :family, :fetch_family
  lock :font_id do
    only_if :new_version_published do
      transaction do
        step :retire_stored_files
        step :refresh_stylesheet
      end
    end
    step :confirm_freshness
  end

  private

  def fetch_font(params:)
    BbCode::Font.find_by(font_id: params.font_id)
  end

  def due_for_revalidation(font:, options:)
    options.force || font.revalidation_due?
  end

  def fetch_family(params:)
    BbCode::Fontsource::Family.fetch(params.font_id)
  end

  def new_version_published(font:, family:)
    font.version != family.version
  end

  def retire_stored_files(font:)
    font.retire_stored_files
  end

  def refresh_stylesheet(font:, family:)
    refreshed =
      font.update(version: family.version, css: BbCode::Font::Action::BuildStylesheet.call(family:))
    fail!(font.errors.full_messages.to_sentence) if !refreshed
  end

  def confirm_freshness(font:)
    font.update!(checked_at: Time.zone.now)
  end
end
