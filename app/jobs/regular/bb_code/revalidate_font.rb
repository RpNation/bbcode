# frozen_string_literal: true

module Jobs
  module BbCode
    class RevalidateFont < ::Jobs::Base
      sidekiq_options retry: false

      # How long after queueing it a font that couldn't be revalidated keeps being served as it is.
      RETRY_DELAY = 6.hours

      def execute(args)
        ::BbCode::Font::Revalidate.call(params: { font_id: args[:font_id] }) do |result|
          # revalidated or evicted since this was queued
          on_failed_policy(:due_for_revalidation) {}
          on_model_not_found(:font) {}
          on_failure do
            Rails.logger.warn(
              "BBCode fonts: could not revalidate #{args[:font_id]}.\n#{result.inspect_steps}",
            )
          end
        end
      end
    end
  end
end
