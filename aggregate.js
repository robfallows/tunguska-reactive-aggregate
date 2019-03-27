export const ReactiveAggregate = (sub, collection = null, pipeline = [], options = {}) => {
  import { Meteor } from 'meteor/meteor';
  import { Mongo } from 'meteor/mongo';
  import { Promise } from 'meteor/promise';

  // Define new Meteor Error type
  const TunguskaReactiveAggregateError = Meteor.makeErrorType('tunguska:reactive-aggregate', function(msg) {
    this.message = msg;
    this.path = '';
    this.sanitizedError = new Meteor.Error('Error', 'tunguska:reactive-aggregate');
  });

  // Check inbound parameter types
  if (!(collection instanceof Mongo.Collection)) {
    throw new TunguskaReactiveAggregateError('collection must be a Mongo.Collection');
  }
  if (!(pipeline instanceof Array)) {
    throw new TunguskaReactiveAggregateError('pipeline must be an array');
  }
  if (!(options instanceof Object)) {
    throw new TunguskaReactiveAggregateError('options must be an object');
  }

  // Set up local options based on defaults and supplied options
  const localOptions = {
    ...{
      noAutomaticObserver: true,
      aggregationOptions: {},
      observeSelector: {},
      observeOptions: {},
      observers: [], // cursor1, ... cursorn
      debounceCount: 100,
      debounceDelay: 100, // mS
      clientCollection: collection._name,
    },
    ...options
  };

  // Check options
  if (typeof localOptions.noAutomaticObserver !== 'boolean') {
    throw new TunguskaReactiveAggregateError('options.noAutomaticObserver must be true or false');
  }
  if (typeof localOptions.observeSelector !== 'object') {
    throw new TunguskaReactiveAggregateError('deprecated options.observeSelector must be an object');
  }
  if (typeof localOptions.observeOptions !== 'object') {
    throw new TunguskaReactiveAggregateError('deprecated options.observeOptions must be an object');
  }
  if (!(localOptions.observers instanceof Array)) {
    throw new TunguskaReactiveAggregateError('options.observers must be an array');
  } else {
    localOptions.observers.forEach((cursor, i) => {
      if (!(cursor instanceof Mongo.Cursor)) {
        throw new TunguskaReactiveAggregateError(`options.observers[${i}] must be a cursor`);
      }
    });
  }
  if (!(typeof localOptions.debounceCount === 'number')) {
    throw new TunguskaReactiveAggregateError('options.debounceCount must be a positive integer');
  } else {
    localOptions.debounceCount = parseInt(localOptions.debounceCount, 10);
    if (localOptions.debounceCount < 0) {
      throw new TunguskaReactiveAggregateError('options.debounceCount must be a positive integer');
    }
  }
  if (!(typeof localOptions.debounceDelay === 'number')) {
    throw new TunguskaReactiveAggregateError('options.debounceDelay must be a positive integer');
  } else {
    localOptions.debounceDelay = parseInt(localOptions.debounceDelay, 10);
    if (localOptions.debounceDelay < 0) {
      throw new TunguskaReactiveAggregateError('options.debounceDelay must be a positive integer');
    }
  }
  if (typeof localOptions.clientCollection !== 'string') {
    throw new TunguskaReactiveAggregateError('options.clientCollection must be a string');
  }
  
  
  // Warn about deprecated parameters if used
  if (Object.keys(localOptions.observeSelector).length != 0) console.log('tunguska:reactive-aggregate: observeSelector is deprecated');
  if (Object.keys(localOptions.observeOptions).length != 0) console.log('tunguska:reactive-aggregate: observeOptions is deprecated');

  // observeChanges() will immediately fire an "added" event for each document in the query
  // these are skipped using the initializing flag
  let initializing = true;
  sub._ids = {};
  sub._iteration = 1;

  const update = async () => {
    if (initializing) return;
    // add and update documents on the client
    try {
      const docs = await collection.rawCollection().aggregate(pipeline, localOptions.aggregationOptions).toArray();
      docs.forEach(doc => {
        if (!sub._ids[doc._id]) {
          sub.added(localOptions.clientCollection, doc._id, doc);
        } else {
          sub.changed(localOptions.clientCollection, doc._id, doc);
        }
        sub._ids[doc._id] = sub._iteration;
      });

      // remove documents not in the result anymore
      Object.keys(sub._ids).forEach(id => {
        if (sub._ids[id] !== sub._iteration) {
          delete sub._ids[id];
          sub.removed(localOptions.clientCollection, id);
        }
      });
      sub._iteration++;
    } catch (err) {
      throw new TunguskaReactiveAggregateError (err.message);
    }
  }

  let currentDebounceCount = 0;
  let timer;

  const debounce = () => {
    if (initializing) return;
    if (!timer && localOptions.debounceCount > 0) timer = Meteor.setTimeout(update, localOptions.debounceDelay);
    if (currentDebounceCount++ > localOptions.debounceCount) {
      currentDebounceCount = 0;
      Meteor.clearTimeout(timer);
      update();
    }
  }

  if (!localOptions.noAutomaticObserver) {
    const query = collection.find(localOptions.observeSelector, localOptions.observeOptions);
    localOptions.observers.push(query);
  }

  const handles = [];
  // track any changes on the observed cursors
  localOptions.observers.forEach((query) => {
    handles.push(query.observeChanges({
      added: debounce,
      changed: debounce,
      removed: debounce,
      error(err) {
        throw new TunguskaReactiveAggregateError (err.message);
      }
    }));
  });
  // End of the setup phase.
  
  // Clear the initializing flag. From here, we're on autopilot
  initializing = false;
  // send an initial result set to the client
  Promise.await(update());
  // mark the subscription as ready
  sub.ready();

  // stop observing the cursors when the client unsubscribes
  sub.onStop(function () {
    handles.forEach(handle => {
      handle.stop();
    });
  });
};
