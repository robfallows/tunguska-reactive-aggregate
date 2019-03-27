export const ReactiveAggregate = (sub, collection = null, pipeline = [], options = {}) => {
  import { Meteor } from 'meteor/meteor';
  import { Mongo } from 'meteor/mongo';
  import { Promise } from 'meteor/promise';

  if (collection !== null && collection !== instanceof Mongo.Collection) {
    throw new Error('E-collection', 'tunguska:reactive-aggregate: collection must be null or a Mongo.Collection');
  }

  if (pipeline !== instanceof Array) {
    throw new Error('E-pipeline', 'tunguska:reactive-aggregate: pipeline must be an array');
  }

  if (options !== instanceof Object) {
    throw new Error('E-options', 'tunguska:reactive-aggregate: options must be an object');
  }

  const localOptions = {
    ...{
      aggregationOptions: {},
      observeSelector: {},
      observeOptions: {},
      observers: [], // cursor1, ... cursorn
      debounceDelay: 100, // mS
      debounceCount: 100,
    },
    ...options
  };

  localOptions.clientCollection = collection === null ? null : collection._name;
  if (typeof localOptions.clientCollection !== 'string') {
    throw new Error('E-clientCollection', 'tunguska:reactive-aggregate: options.clientCollection must be specified if collection is null');
  }

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
      throw new Error ('E-pub', `tunguska:reactive-aggregate: ${err.message}`);
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

  if (collection !== null) {
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
        throw err;
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
