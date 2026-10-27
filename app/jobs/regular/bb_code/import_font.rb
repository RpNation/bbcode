# frozen_string_literal: true

module Jobs
  module BbCode
    class ImportFont < ::Jobs::Base
      sidekiq_options retry: false

      # How long after queueing it a family that failed to import is left alone.
      RETRY_DELAY = 10.minutes

      def execute(args)
        ::BbCode::Font::Import.call(params: { font_id: args[:font_id] }) do |result|
          on_failure do
            Rails.logger.warn(
              "BBCode fonts: could not import #{args[:font_id]}.\n#{result.inspect_steps}",
            )
          end
        end
      end
    end
  end
end
