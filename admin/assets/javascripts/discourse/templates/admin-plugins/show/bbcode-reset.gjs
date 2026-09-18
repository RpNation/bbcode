import DPageSubheader from "discourse/ui-kit/d-page-subheader";
import { i18n } from "discourse-i18n";

export default <template>
  <div class="admin-detail bbcode-reset">
    <DPageSubheader
      @descriptionLabel={{i18n "bbcode.resetDesc"}}
      @titleLabel={{i18n "bbcode.title"}}
    >
      <:actions as |actions|>
        <actions.Primary
          @action={{@controller.resetServerJSContext}}
          @icon="arrow-rotate-right"
          @isLoading={{@controller.isResetting}}
          @label="bbcode.reset"
        />
      </:actions>
    </DPageSubheader>

    {{#if @controller.success}}
      <div class="alert alert-success">{{i18n "bbcode.success"}}</div>
    {{/if}}

    {{#if @controller.error}}
      <div class="alert alert-error">{{i18n "bbcode.error"}}</div>
    {{/if}}
  </div>
</template>
