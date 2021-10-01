import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import EmberObject, { action } from '@ember/object';
import Controller from '@ember/controller';

export default class BooksController extends Controller {

  @service store
  @tracked bookEntry

  initBookEntry() {
    //console.log("initBookEntry()");
    this.bookEntry = EmberObject.create();
  }

  @action
  async removeBook(book) {
    alert("Removal of books is broken in the backend. Look at the mu-authorization for that.");
    book.deleteRecord();
    return await book.save();
  }

  @action
  async createBook(bookData) {
    //console.log("createBook($1)", bookData);
    //console.log("Create book record");
    const book = await this.store.createRecord("book");
    //console.log("Set title");
    await book.set('title', bookData.title);
    //console.log("Save book");
    await book.save();
    //console.log("Init new book entry");
    this.initBookEntry();
    //this.refresh();
  }

  @action
  refresh() {
    //console.log("refresh()");
    this.send("refreshModel");
  }
}
