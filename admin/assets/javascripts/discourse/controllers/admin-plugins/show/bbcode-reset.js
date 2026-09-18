import { tracked } from "@glimmer/tracking";
import Controller from "@ember/controller";
import { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";

export default class AdminPluginsShowBbcodeResetController extends Controller {
  @tracked error = false;
  @tracked isResetting = false;
  @tracked success = false;

  @action
  resetServerJSContext() {
    this.isResetting = true;
    this.success = false;
    this.error = false;

    ajax("/BbCode/admin/refresh", { type: "POST" })
      .then(() => {
        this.success = true;
      })
      .catch(() => {
        this.error = true;
      })
      .finally(() => {
        this.isResetting = false;
      });
  }
}
