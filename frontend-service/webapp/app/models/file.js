import Model, { attr, belongsTo } from '@ember-data/model';

export default class FileModel extends Model {
  @attr("string") name;
  @attr("string") format;
  @attr("number") size;
  @attr("string") extension;
  @attr("date")   created;

  @belongsTo("file") file;
}
