import DS from 'ember-data';
const { Model, attr } = DS;

export default class BookModel extends Model {
  @attr("string") title;
}
