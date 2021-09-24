import Controller from '@ember/controller';

export default class ApplicationController extends Controller {

  constructor() {
    super(...arguments);
    const isProducer = window.location.port == '81' || window.location.host == 'books.rpio-dev.s.redpencil.io';
    this.role = isProducer ? 'producer' : 'consumer';
  }
}

