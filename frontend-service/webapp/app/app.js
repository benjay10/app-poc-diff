import Application from '@ember/application';
//import Resolver from './resolver';
import Resolver from "ember-resolver";
import loadInitializers from 'ember-load-initializers';
import config from './config/environment';

export default class App extends Application {
  modulePrefix = config.modulePrefix;
  podModulePrefix = config.podModulePrefix;
  Resolver = Resolver;
}

//const App = Application.extend({
//  modulePrefix: config.modulePrefix,
//  podModulePrefix: config.podModulePrefix,
//  Resolver
//});

loadInitializers(App, config.modulePrefix);

