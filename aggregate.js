export const ReactiveAggregate = (sub, collection, pipeline, options) => {
  const defaultOptions = {
    aggregationOptions: {},
    observeSelector: {},
    observeOptions: {},
    clientCollection: collection._name
  };
  options = _.extend(defaultOptions, options);

  let initializing = true;
  sub._ids = {};
  sub._iteration = 1;

  const update = async () => {
    if (initializing) return;
    // add and update documents on the client
    const docs = await collection.rawCollection().aggregate(pipeline, options.aggregationOptions);
    docs.forEach(doc => {
      if (!sub._ids[doc._id]) {
        sub.added(options.clientCollection, doc._id, doc);
      } else {
        sub.changed(options.clientCollection, doc._id, doc);
      }
      sub._ids[doc._id] = sub._iteration;
    });
    // remove documents not in the result anymore
    Object.keys(sub._ids).forEach((v, k) => {
      if (v !== sub._iteration) {
        delete sub._ids[k];
        sub.removed(options.clientCollection, k);
      }
    });
    sub._iteration++;
  }

  // track any changes on the collection used for the aggregation
  const query = collection.find(options.observeSelector, options.observeOptions);
  const handle = query.observeChanges({
    added: update,
    changed: update,
    removed: update,
    error(err) {
      throw err;
    }
  });
  // observeChanges() will immediately fire an "added" event for each document in the query
  // these are skipped using the initializing flag
  initializing = false;
  // send an initial result set to the client
  update();
  // mark the subscription as ready
  sub.ready();

  // stop observing the cursor when the client unsubscribes
  sub.onStop(function () {
    handle.stop();
  });
};
