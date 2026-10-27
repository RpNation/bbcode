# frozen_string_literal: true

class BbCode::Font::Action::DestroyUploads < Service::ActionBase
  option :references

  # Removes the given upload references, then the uploads that nothing refers to any more.
  def call
    upload_ids = references.distinct.pluck(:upload_id)
    references.delete_all

    Upload
      .where(id: upload_ids)
      .where(
        "NOT EXISTS (SELECT 1 FROM upload_references WHERE upload_references.upload_id = uploads.id)",
      )
      .find_each(&:destroy)
  end
end
