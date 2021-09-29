import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import EmberObject, { action } from '@ember/object';
import { task } from 'ember-concurrency';

export default class FilesController extends Controller {

  @service store;
  @tracked fileEntry;

  initFileEntry() {
    this.fileEntry = EmberObject.create();
  }

  @task({ maxConcurrency: 1, enqueue: true })
  *uploadFile(file) {
    //let filemodel = this.store.createRecord("file", {
    //});
    let uploadResponse = yield file.upload("/files/");
    console.log("File uploaded, response is: ", uploadResponse);

  }

  @action
  async removeFile(file) {

  }

  @action
  fileAdd(file) {
    console.log("We would like to add a file", file);
    return this.uploadFile.perform(file);
  }

  @action
  refresh() {
    this.send("refreshModel");
  }
}
