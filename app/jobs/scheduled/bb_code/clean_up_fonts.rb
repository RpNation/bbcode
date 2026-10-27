# frozen_string_literal: true

module Jobs
  module BbCode
    class CleanUpFonts < ::Jobs::Scheduled
      every 1.day

      def execute(args)
        return if !SiteSetting.bbcode_enabled

        ::BbCode::Font
          .idle
          .pluck(:font_id)
          .each { |font_id| ::BbCode::Font::Evict.call(params: { font_id: }) }

        ::BbCode::Font::Action::DestroyUploads.call(
          references: ::BbCode::Font.retired_references_past_grace,
        )
      end
    end
  end
end
