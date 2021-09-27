import JSONAPIAdapter from '@ember-data/adapter/json-api';

export default class ApplicationAdapter extends JSONAPIAdapter {
  //namespace = "api";
  host = window.location.protocol + "//" + window.location.host + "/api";
}
