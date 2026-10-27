# frozen_string_literal: true

module ::BbCode
  module Fontsource
    ID_FORMAT = /\A[a-z0-9]+(?:-[a-z0-9]+)*\z/
    FILENAME_FORMAT =
      /\A(?<key>[a-z0-9]+(?:-[a-z0-9]+)*)-(?<axis>wght|\d+)-(?<style>normal|italic)\.woff2\z/
  end
end

require_relative "fontsource/client"
require_relative "fontsource/font_list"
require_relative "fontsource/family"
