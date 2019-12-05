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
  if (!(sub && sub.ready && sub.stop)) {
    throw new TunguskaReactiveAggregateError('unexpected context - did you set "sub" to "this"?');
  }
  if (!(collection instanceof Mongo.Collection)) {
    throw new TunguskaReactiveAggregateError('"collection" must be a Mongo.Collection');
  }
  if (!(pipeline instanceof Array)) {
    throw new TunguskaReactiveAggregateError('"pipeline" must be an array');
  }
  if (!(options instanceof Object)) {
    throw new TunguskaReactiveAggregateError('"options" must be an object');
  }

  // Set up local options based on defaults and supplied options
  const localOptions = {
    ...{
      noAutomaticObserver: false,
      aggregationOptions: {},
      observeSelector: {},
      observeOptions: {},
      observers: [], // cursor1, ... cursorn
      debounceCount: 0,
      debounceDelay: 0, // mS
      clientCollection: collection._name,
      debug: false,
    },
    ...options
  };

  // Check options
  if (typeof localOptions.noAutomaticObserver !== 'boolean') {
    throw new TunguskaReactiveAggregateError('"options.noAutomaticObserver" must be true or false');
  }
  if (typeof localOptions.observeSelector !== 'object') {
    throw new TunguskaReactiveAggregateError('deprecated "options.observeSelector" must be an object');
  }
  if (typeof localOptions.observeOptions !== 'object') {
    throw new TunguskaReactiveAggregateError('deprecated "options.observeOptions" must be an object');
  }
  if (!(localOptions.observers instanceof Array)) {
    throw new TunguskaReactiveAggregateError('"options.observers" must be an array of cursors');
  } else {
    localOptions.observers.forEach((cursor, i) => {
      // The obvious "cursor instanceof Mongo.Cursor" doesn't seem to work, so...
      if (!(cursor._cursorDescription && cursor._cursorDescription.collectionName)) {
        throw new TunguskaReactiveAggregateError(`"options.observers[${i}]" must be a cursor`);
      }
    });
  }
  if (!(typeof localOptions.debounceCount === 'number')) {
    throw new TunguskaReactiveAggregateError('"options.debounceCount" must be a positive integer');
  } else {
    localOptions.debounceCount = parseInt(localOptions.debounceCount, 10);
    if (localOptions.debounceCount < 0) {
      throw new TunguskaReactiveAggregateError('"options.debounceCount" must be a positive integer');
    }
  }
  if (!(typeof localOptions.debounceDelay === 'number')) {
    throw new TunguskaReactiveAggregateError('"options.debounceDelay" must be a positive integer');
  } else {
    localOptions.debounceDelay = parseInt(localOptions.debounceDelay, 10);
    if (localOptions.debounceDelay < 0) {
      throw new TunguskaReactiveAggregateError('"options.debounceDelay" must be a positive integer');
    }
  }
  if (typeof localOptions.clientCollection !== 'string') {
    throw new TunguskaReactiveAggregateError('"options.clientCollection" must be a string');
  }
  if (typeof localOptions.debug !== 'function' && localOptions.debug !== true && localOptions.debug !== false) {
    throw new TunguskaReactiveAggregateError('"options.debug" must be a boolean or a callback');
  }


  // Warn about deprecated parameters if used
  if (Object.keys(localOptions.observeSelector).length !== 0) console.log('tunguska:reactive-aggregate: observeSelector is deprecated');
  if (Object.keys(localOptions.observeOptions).length !== 0) console.log('tunguska:reactive-aggregate: observeOptions is deprecated');

  // observeChanges() will immediately fire an "added" event for each document in the cursor
  // these are skipped using the initializing flag
  let initializing = true;
  sub._ids = {};
  sub._iteration = 1;

  const update = () => {
    // add and update documents on the client
    try {
      const docs = Promise.await(collection.rawCollection().aggregate(pipeline, localOptions.aggregationOptions).toArray());
      docs.forEach(doc => {

        /*  _ids are complicated:
            For tracking here, they must be String
            For minimongo, they must exist and be
              String or ObjectId
              (however, we'll arbitrarily exclude ObjectId)
            _ids coming from an aggregation pipeline may be anything or nothing!
          ObjectIds coming via toArray() become POJOs
        */

        let doc_id;
        if (!doc._id) { // missing or otherwise falsy
          throw new TunguskaReactiveAggregateError('every aggregation document must have an _id');
        } else if (doc._id instanceof Mongo.ObjectID) {
          doc_id = doc._id.toHexString();
        } else if (typeof doc._id === 'object') {
          doc_id = doc._id.toString();
        } else if (typeof doc._id !== 'string') {
          throw new TunguskaReactiveAggregateError('aggregation document _id is not an allowed type');
        } else {
          doc_id = doc._id;
        }

        // If we got here, doc_id must be a string
        if (!sub._ids[doc_id]) {
          sub.added(localOptions.clientCollection, doc_id, doc);
        } else {
          if (sub._session.collectionViews.documents instanceof Map) {
            // Since the pipeline fields might have been removed, we need to find the differences and define them as 'undefined' so the sub removes them.
            const previousFields = [...sub._session.collectionViews.documents.get(localOptions.clientCollection).get(doc_id).dataByKey.keys()];
            previousFields.forEach(field => {
              // At this point they are undefined because they no longer exist in the new doc, they're not literally set as undefined
              if( doc[field] === undefined ) {
                // We need to explicitly define this as undefined so the sub will remove them.
                doc[field] = undefined;
              }
            });
          }
          sub.changed(localOptions.clientCollection, doc_id, doc);
        }
        sub._ids[doc_id] = sub._iteration;
      });

      // remove documents not in the result anymore
      Object.keys(sub._ids).forEach(id => {
        if (sub._ids[id] !== sub._iteration) {
          delete sub._ids[id];
          sub.removed(localOptions.clientCollection, id);
        }
      });
      sub._iteration++;
      if (localOptions.debug) console.log(`Reactive-Aggregate: publish: ready`)
      sub.ready();           // Mark the subscription as ready
    } catch (err) {
      throw new TunguskaReactiveAggregateError (err.message);
    }
  }

  let currentDebounceCount = 0;
  let timer;

  const debounce = (notification) => {
    if (initializing) return;
    if (localOptions.debug) console.log(`Reactive-Aggregate: collection: ${notification.name}: publish: ${notification.mutation}, _id: ${notification.id}`)
    if (!timer && localOptions.debounceCount > 0) timer = Meteor.setTimeout(update, localOptions.debounceDelay);
    if (++currentDebounceCount > localOptions.debounceCount) {
      currentDebounceCount = 0;
      Meteor.clearTimeout(timer);
      update();
    }
  }

  if (!localOptions.noAutomaticObserver) {
    const cursor = collection.find(localOptions.observeSelector, localOptions.observeOptions);
    localOptions.observers.push(cursor);
  }

  const handles = [];
  // track any changes on the observed cursors
  localOptions.observers.forEach(cursor => {
    const name = cursor._cursorDescription.collectionName;
    if (localOptions.debug) console.log(`Reactive-Aggregate: collection: ${name}: initialise observer`)
    handles.push(cursor.observeChanges({
      added(id) {
        debounce({ name, mutation: 'added', id } );
      },
      changed(id) {
        debounce({ name, mutation: 'changed', id });
      },
      removed(id) {
        debounce({ name, mutation: 'removed', id });
      },
      error(err) {
        throw new TunguskaReactiveAggregateError (err.message);
      }
    }));
  });

  // stop observing the cursors when the client unsubscribes
  sub.onStop(() => {
    if (options.debug) console.log(`Reactive-Aggregate: stopping observers`)
    handles.forEach(handle => {
      handle.stop();
    });
  });
  // End of the setup phase. We don't need to do any of that again!

  if (typeof localOptions.debug === 'function') {
    const explain = Promise.await(collection.rawCollection().aggregate(pipeline, localOptions.aggregationOptions).explain());
    localOptions.debug(explain);
  }

  initializing = false;  // Clear the initializing flag. From here, we're on autopilot
  update();              // Send an initial result set to the client

};
