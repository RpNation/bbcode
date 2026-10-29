# frozen_string_literal: true

module ::BbCode
  module Fontsource
    # A font family as Fontsource describes it, reduced to the faces a stylesheet needs.
    #
    # A variable family has one file per subset and style covering its whole weight range.
    # A static family has one file per subset, style and weight.
    class Family
      Face = Data.define(:weight, :style, :filename, :unicode_range)

      VARIABLE_AXIS = "wght"
      WEIGHT_FORMAT = /\A\d{1,4}( \d{1,4})?\z/
      UNICODE_RANGE_FORMAT =
        /\AU\+[0-9A-Fa-f?]{1,6}(-[0-9A-Fa-f]{1,6})?(,U\+[0-9A-Fa-f?]{1,6}(-[0-9A-Fa-f]{1,6})?)*\z/

      attr_reader :font_id, :name, :version

      # nil when Fontsource can't be reached or doesn't know the family.
      def self.fetch(font_id)
        metadata = Client.metadata(font_id)
        axes = Client.axes(font_id)
        return if metadata.nil? || axes.nil?

        family = new(metadata:, axes:, variable: false)
        variable = family.variable? && Client.file_exists?(family.variable_probe_url)
        variable ? new(metadata:, axes:, variable: true) : family
      end

      def initialize(metadata:, axes:, variable:)
        @metadata = metadata
        @axes = axes
        @variable = variable
        @font_id = metadata["id"]
        @name = metadata["family"]
        @version = metadata["npmVersion"]
      end

      # Whether the family declares a weight axis; Fontsource doesn't always publish files for it.
      def variable?
        @metadata["variable"] == true && @axes.key?(VARIABLE_AXIS)
      end

      def variable_probe_url
        subset = @metadata["defSubset"]
        styles = @metadata["styles"]
        style = styles.include?("normal") ? "normal" : styles.first
        Client.file_url(font_id, version, "#{subset}-#{VARIABLE_AXIS}-#{style}.woff2")
      end

      def faces
        @variable ? variable_faces : static_faces
      end

      private

      def variable_faces
        axis = @axes[VARIABLE_AXIS]
        weight = "#{axis["min"].to_i} #{axis["max"].to_i}"

        @metadata["styles"].flat_map do |style|
          file_keys(style).filter_map { |key| face(weight, style, key, VARIABLE_AXIS) }
        end
      end

      def static_faces
        @metadata["variants"].flat_map do |weight, styles|
          styles.flat_map do |style, files|
            files.keys.filter_map { |key| face(weight, style, key, weight) }
          end
        end
      end

      def file_keys(style)
        @metadata["variants"].each_value.first.fetch(style, {}).keys
      end

      # Everything in a face ends up in a stylesheet, so a face that isn't well formed is skipped.
      # So are files without a unicode range: a browser would download them for every page.
      def face(weight, style, key, weight_token)
        filename = "#{key}-#{weight_token}-#{style}.woff2"
        range = unicode_range(key)
        return if !weight.match?(WEIGHT_FORMAT) || !filename.match?(FILENAME_FORMAT)
        return if !range.to_s.match?(UNICODE_RANGE_FORMAT)

        Face.new(weight:, style:, filename:, unicode_range: range)
      end

      # Numbered slices are keyed as "[12]" in the ranges but named "12" in the files.
      def unicode_range(key)
        ranges = @metadata["unicodeRange"]
        ranges[key] || ranges["[#{key}]"]
      end
    end
  end
end
