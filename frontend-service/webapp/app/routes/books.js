import { action } from '@ember/object';
import Route from '@ember/routing/route';

export default class BooksRoute extends Route {

  async model() {
    this.store.unloadAll('book'); // required to sync removals
    return this.store.findAll('book');
  }

  async afterModel() {
    // later(this.refreshModel, 5000);  // automatically reload model in 5s
  }

  setupController(controller) {
    super.setupController(...arguments);
    controller.initBookEntry();
  }

  @action
  refreshModel() {
    this.refresh();
  }

}

