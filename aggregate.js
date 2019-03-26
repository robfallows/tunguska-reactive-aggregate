export const ReactiveAggregate = (sub, collection, pipeline, options) => {
  import {
    Promise
  } from 'meteor/promise';
  const defaultOptions = {
    aggregationOptions: {},
    observeSelector: {},
    observeOptions: {},
    observers: [], // cursor1, ... cursorn
    debounceDelay: 100, // mS
    debounceCount: 100,
    clientCollection: collection._name
  };
  const localOptions = _.extend(defaultOptions, options);

  let currentDebounceCount = 0;

  let initializing = true;
  sub._ids = {};
  sub._iteration = 1;

  const update = async () => {
    if (initializing) return;
    // add and update documents on the client
    try {
      const docs = await collection.rawCollection().aggregate(pipeline, options.aggregationOptions).toArray();
      docs.forEach(doc => {
        if (!sub._ids[doc._id]) {
          sub.added(options.clientCollection, doc._id, doc);
        } else {
          sub.changed(options.clientCollection, doc._id, doc);
        }
        sub._ids[doc._id] = sub._iteration;
      });

      // remove documents not in the result anymore
      Object.keys(sub._ids).forEach(id => {
        if (sub._ids[id] !== sub._iteration) {
          delete sub._ids[id];
          sub.removed(options.clientCollection, id);
        }
      });
      sub._iteration++;
    } catch (err) {
      throw err;
    }
  }

  const debounce = () => {
    if (initializing) return;
    const timer = Meteor.setTimeout(update, options.debounceDelay);
    if (currentDebounceCount++ > localOptions.debounceCount) {
      currentDebounceCount = 0;
      Meteor.cancelTimeout(timer);
      update();
    }
  }

  // track any changes on the collection used for the aggregation
  const query = collection.find(options.observeSelector, options.observeOptions);
  const handle = query.observeChanges({
    added: debounce,
    changed: debounce,
    removed: debounce,
    error(err) {
      throw err;
    }
  });
  // observeChanges() will immediately fire an "added" event for each document in the query
  // these are skipped using the initializing flag
  initializing = false;
  // send an initial result set to the client
  Promise.await(update());
  // mark the subscription as ready
  sub.ready();

  // stop observing the cursor when the client unsubscribes
  sub.onStop(function () {
    handle.stop();
  });
};
