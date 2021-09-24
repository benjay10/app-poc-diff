import { action } from '@ember/object';
import Component from '@glimmer/component';

export default class BookEntryComponent extends Component {
  @action
  submit(event){
    event.preventDefault();
    this.args.onSubmit(this.args.book);
  }
}
