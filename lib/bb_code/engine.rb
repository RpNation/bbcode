# frozen_string_literal: true

module ::BbCode
  class Engine < ::Rails::Engine
    engine_name PLUGIN_NAME
    isolate_namespace BbCode
  end
end