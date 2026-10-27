# frozen_string_literal: true

class BbCode::Font::Action::StoreFile < Service::ActionBase
  # How long a file that couldn't be downloaded is left alone, so a slow or unavailable Fontsource
  # doesn't tie up a request for every visitor asking for it.
  RETRY_DELAY = 1.minute

  option :font
  option :filename

  # The stored upload, or nil when the file can't be downloaded.
  def call
    return if Discourse.redis.exists?(failure_key)

    file = download
    return remember_failure if file.nil?

    upload = UploadCreator.new(file, filename, for_theme: true).create_for(Discourse.system_user.id)
    return remember_failure if !upload.persisted?

    UploadReference.find_or_create_by!(target: font, upload:)
    upload
  ensure
    file&.close!
  end

  private

  def download
    url = BbCode::Fontsource::Client.file_url(font.font_id, font.version, filename)
    BbCode::Fontsource::Client.download(url) if url
  end

  def remember_failure
    Discourse.redis.set(failure_key, 1, ex: RETRY_DELAY.to_i)
    nil
  end

  def failure_key
    "bbcode-font-file-failed:#{font.font_id}:#{filename}"
  end
end
