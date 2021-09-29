import Route from '@ember/routing/route';
import { action } from '@ember/object';

export default class FilesRoute extends Route {

  async model() {
    this.store.unloadAll("file");
    return this.store.findAll("file");
  }

  async afterModel() {
    //Probably nothing
  }

  setupController(controller) {
    super.setupController(...arguments);
    controller.initFileEntry();
  }

  @action
  refreshModel() {
    this.refresh();
  }
}
