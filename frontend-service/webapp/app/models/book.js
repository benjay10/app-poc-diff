import Model, { attr } from "@ember-data/model";

export default class BookModel extends Model {
  @attr("string") title;
}

