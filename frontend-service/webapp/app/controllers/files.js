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

  filterFiles(model) {
    model = model || this.model;
    //console.log("Filtering files", model);
    //Only show the file objects that refer to a virtual file. The physical files is part of the implementation and does not provide usefull info
    model = model.filter((item, index, array) => {
      return item.get("download").get("name") ? true : false;
    });

    //Create a downloadlink on the file, referring to the file-service
    model.forEach((item, index) => {
      //console.log("Creating download link for item:", item);
      item.downloadLink = `/api/files/${item.id}/download?name=${item.name}`;
    });

    this.model = model;
  }

  @task({ maxConcurrency: 1, enqueue: true })
  *uploadFile(file) {
    let uploadResponse = yield file.upload("/api/files/");
    //console.log("File uploaded, response is: ", uploadResponse);
    //Create a virtual file, will be shown in the UI
    let newVFile = yield this.store.createRecord("file", {
      id:        uploadResponse.body.data.id,
      name:      uploadResponse.body.data.attributes.name,
      format:    uploadResponse.body.data.attributes.format,
      size:      uploadResponse.body.data.attributes.size,
      extension: uploadResponse.body.data.attributes.extension,
      created:   Date.now()
    });
    //Create a physical file, is necessary, but won't be shown anywere
    let newPFile = yield this.store.createRecord("file", {
      name:      uploadResponse.body.data.id,
      format:    uploadResponse.body.data.attributes.format,
      size:      uploadResponse.body.data.attributes.size,
      extension: uploadResponse.body.data.attributes.extension,
      created:   Date.now()
    });
    //Link the two files correctly
    newVFile.download = newPFile;
    //Update the model to show on screen
    yield this.model.pushObject(newVFile);
    //Filter the model and create links
    //console.log("During file upload, model pushed, filtering them now, amount of file:", this.model.length);
    this.filterFiles(this.model);
    //Return something, maybe irrelavant at this point
    yield uploadResponse;
  }

  @task({ maxConcurrency: 1, enqueue: true})
  *deleteFile(file) {
    yield fetch(`/api/files/${file.id}`, {
      method: "DELETE"
    });
  }

  @action
  async removeFile(file) {
    //console.log("Wants to remove file:", file);
    alert("Removal of files is broken in the backend. Look at the mu-authorization for that.");
    await this.deleteFile.perform(file);
    //await file.get("download").destroyRecord(); //Not necessary, file service will do this.
    await file.destroyRecord();
    this.model.removeObject(file);
  }

  @action
  async fileAdd(file) {
    //console.log("We would like to add a file", file);
    let result = await this.uploadFile.perform(file);
    //console.log("File uploaded, this is the response: ", result);
    //this.refresh();
    //this.filterFiles();
  }

  @action
  async refresh() {
    this.send("refreshModel");
    this.filterFiles();
  }
}
