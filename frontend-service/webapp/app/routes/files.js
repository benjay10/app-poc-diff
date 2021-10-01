import Route from '@ember/routing/route';
import { action } from '@ember/object';

export default class FilesRoute extends Route {

  async model() {
    //this.store.unloadAll("file");
    return this.store.findAll("file", { include: "download" });
  }

  async afterModel() {
    //Probably nothing
  }

  setupController(controller, model) {
    super.setupController(...arguments);
    controller.initFileEntry();
    controller.filterFiles();
  }

  @action
  refreshModel() {
    this.refresh();
  }
}
