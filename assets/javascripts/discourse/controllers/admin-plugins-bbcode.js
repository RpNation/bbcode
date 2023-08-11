import Controller from "@ember/controller";
import { action } from "@ember/object";
import { tracked } from "@glimmer/tracking";
import { ajax } from "discourse/lib/ajax";

export default class AdminPluginsBBCodeController extends Controller {
  @tracked resetEnabled = true;
  @tracked success = false;
  @tracked error = false;

  @action
  resetServerJSContext() {
    this.resetEnabled = false;
    this.success = false;
    this.error = false;
    ajax("/BbCode/admin/refresh")
      .then(() => {
        // success
        this.resetEnabled = true;
        this.success = true;
      })
      .catch(() => {
        // error
        this.resetEnabled = true;
        this.error = true;
      });
  }
}
