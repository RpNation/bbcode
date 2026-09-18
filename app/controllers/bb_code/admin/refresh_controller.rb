# frozen_string_literal: true

module ::BbCode
  module Admin
    class RefreshController < ::Admin::AdminController
      requires_plugin PLUGIN_NAME
      def index
        MessageBus.publish(::BbCode::ENGINE_RESET_CHANNEL, {})

        PrettyText.reset_context
        begin
          # Skip warmup in development mode - it makes boot take ~2s longer
          PrettyText.cook("warm up **pretty text**")
          render json: success_json
        rescue => e
          Rails.logger.error("Failed to warm up pretty text: #{e}")
          render json: failed_json, status: 500
        end
      end
    end
  end
end
