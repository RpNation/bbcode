import DButton from "discourse/ui-kit/d-button";
import { i18n } from "discourse-i18n";

<template>
  <h3>{{i18n "bbcode.title"}}</h3>
  <p>{{i18n "bbcode.resetDesc"}}</p>

  <div class="buttons">
    {{#if @controller.resetEnabled}}
      <DButton
        @label="bbcode.reset"
        @action={{@controller.resetServerJSContext}}
        @icon="arrows-rotate"
        id="reset-bbcode"
      />
      {{#if @controller.success}}
        <span style="color: var(--success-medium)">{{i18n "bbcode.success"}}</span>
      {{/if}}
      {{#if @controller.error}}
        <span style="color: var(--danger-medium)">{{i18n "bbcode.error"}}</span>
      {{/if}}
    {{else}}
      <div class="spinner small"></div>
      {{i18n "bbcode.reseting"}}
    {{/if}}
  </div>
</template>
