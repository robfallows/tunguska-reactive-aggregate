import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';

let _errorsDisplayedOnce = false;
export const ReactiveAggregate = async (sub, collection = null, pipeline = [], options = {}) => {

  // Define new Meteor Error type
  const TunguskaReactiveAggregateError = Meteor.makeErrorType('tunguska:reactive-aggregate', function (msg) {
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
      warnings: true,
      aggregationOptions: {},
      observeSelector: {},
      observeOptions: {},
      observers: [], // cursor1, ... cursorn
      debounceCount: 0,
      debounceDelay: 0, // mS
      clientCollection: collection._name,
      debug: false,
      capturePipeline: false,
      objectIDKeysToRepair: [],
      loadObjectIdModules: true,
    },
    ...options,
    specificWarnings: { deprecations:true, objectId:true, ...((options.specificWarnings instanceof Object) ? options.specificWarnings : {}) },
  };

  // Check options
  if (typeof localOptions.noAutomaticObserver !== 'boolean') {
    throw new TunguskaReactiveAggregateError('"options.noAutomaticObserver" must be true or false');
  }
  if (typeof localOptions.warnings !== 'boolean') {
    throw new TunguskaReactiveAggregateError('"options.warnings" must be true or false');
  }
  for (const [name,value] of Object.entries(localOptions.specificWarnings)) {
    if (typeof value !== 'boolean') throw new TunguskaReactiveAggregateError(`"options.specificWarnings.${name}" must be true or false`);
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
  if (localOptions.capturePipeline && typeof localOptions.capturePipeline !== 'function') {
    throw new TunguskaReactiveAggregateError('"options.capturePipeline" must be a callback');
  }
  if (!(localOptions.objectIDKeysToRepair instanceof Array)) {
    throw new TunguskaReactiveAggregateError('"options.objectIDKeysToRepair" must be an array');
  }
  if (typeof localOptions.loadObjectIdModules !== 'boolean') {
    throw new TunguskaReactiveAggregateError('"options.loadObjectIdModules" must be true or false');
  }

  const { specificWarnings } = localOptions;

  // Warn about deprecated parameters if used
  if (localOptions.warnings && specificWarnings.deprecations) {
    if (Object.keys(localOptions.observeSelector).length !== 0) console.log('tunguska:reactive-aggregate: observeSelector is deprecated');
    if (Object.keys(localOptions.observeOptions).length !== 0) console.log('tunguska:reactive-aggregate: observeOptions is deprecated');
  }

  // Handle loading lodash/set and simpl-schema so that ReactiveAggregate
  // will still work (without Mongo.ObjectID support) if they aren't loaded.
  // Also, prefer lodash-es over lodash, but accept either.
  const packageErrors = [];
  let _CircDepPreventionSimpleSchema = null;
  if (localOptions.loadObjectIdModules) {
    let set = null;
    try { set = require('lodash-es/set'); }
    catch (e) {
      try { set = require('lodash/set'); }
      catch (e2) {
        let eCombined = { code: `lodash-es(${e.code || e}), lodash(${e2.code || e2})` };
        packageErrors.push({ name: 'lodash-es or lodash', error: eCombined });
      }
    }
    try { _CircDepPreventionSimpleSchema = require('simpl-schema'); } catch (e) { packageErrors.push({ name: 'simpl-schema', error: e }); }
  }

  const loadedObjectIdModules = localOptions.loadObjectIdModules && packageErrors.length === 0;

  if (localOptions.loadObjectIdModules && !loadedObjectIdModules && !_errorsDisplayedOnce) {
    if (localOptions.warnings && specificWarnings.objectId) {
      console.log(`ReactiveAggregate support for Mongo.ObjectID is disabled due to ${packageErrors.length} package error(s):`);
      packageErrors.forEach((e, i) => { console.log(`   ${i + 1} - ${e.name}: ${e.error.code || e.error}`); });
    }
    _errorsDisplayedOnce = true;
  }

  // observeChanges() will immediately fire an "added" event for each document in the cursor
  // these are skipped using the initializing flag
  let initializing = true;
  sub._ids = {};
  sub._iteration = 1;
  let schemaContext = null;
  let schema = collection.schema;

  // The caller can explicitly provide schema keys, but they have to get them exactly right
  // or they'll be debugging why things aren't working. In (hopefully) nearly all cases,
  // the code here will deduce which keys define ObjectIDs and automatically repair them.
  if (loadedObjectIdModules && (localOptions.objectIDKeysToRepair.length === 0)) {
    // Find the ObjectIDs to repair in the schema,
    // since it's not overridden by specified ones in the options.
    if (schema instanceof _CircDepPreventionSimpleSchema.default) {
      schemaContext = schema.newContext();

      let mergedSchema = schema.mergedSchema();
      Object.entries(mergedSchema).forEach(([key, rawDef]) => {
        let def = schema.getDefinition(key);
        for (let type of def.type) {
          if (type.type === Mongo.ObjectID) {
            localOptions.objectIDKeysToRepair.push(key);
            break;
          }
        }
      });
    }
  }

  // Remove '_id' as an objectID to repair if present, since it's done anyway.
  localOptions.objectIDKeysToRepair = localOptions.objectIDKeysToRepair.filter(field => field !== '_id');

  // Use lodash set to mutate the doc by setting the dotted path key to the
  // Mongo.ObjectID format of the object id's value.
  const repairObjectID = (doc, key, valueToRepair) => {
    if (valueToRepair instanceof MongoInternals.NpmModule.ObjectID)
      set(doc, key, new Mongo.ObjectID(valueToRepair.toString()));
    // This is the very specific case in which a Mongo.ObjectID has gotten run through
    // some BSONifier twice -- converting it the first time to a MongoInternals.NpmModule.ObjectID
    // and the second time from that to a POJO with the id being a Uint8Array.
    else if (valueToRepair && (typeof valueToRepair === 'object') && (valueToRepair.id instanceof Uint8Array))
      set(doc, key, new Mongo.ObjectID(Buffer.from(valueToRepair.id).toString("hex")));
  }

  const update = async () => {
    // add and update documents on the client
    try {
      if (localOptions.debug) console.log(`Reactive-Aggregate: Running aggregation pipeline`)
      const docs = await collection.rawCollection().aggregate(pipeline, localOptions.aggregationOptions).toArray();
      docs.forEach(doc => {

        /*  _ids are complicated:
            For tracking here, track the string version of them
            For minimongo, they must exist
              and be String or ObjectId
            rawCollection() methods (like aggregate) convert ObjectIds to
              MongoInternals.NpmModule.ObjectIDs, so convert them back
            _ids coming from an aggregation pipeline may be anything or nothing!
        */

        let doc_id;
        if (!doc._id) { // missing or otherwise falsy
          throw new TunguskaReactiveAggregateError('every aggregation document must have an _id');
        } else if (doc._id instanceof Mongo.ObjectID) {
          doc_id = doc._id.toHexString();
        } else if (doc._id instanceof MongoInternals.NpmModule.ObjectID) {
          // This means it was an ObjectID that got converted by rawCollection() methods
          // that use the underlying MongoDB driver, so convert it back.
          doc_id = doc._id.toString();
          doc._id = new Mongo.ObjectID(doc_id);
        } else if (typeof doc._id === 'object') {
          // This is some other kind of object, so leave it as is.
          doc_id = doc._id.toString();
        } else if (typeof doc._id !== 'string') {
          throw new TunguskaReactiveAggregateError('aggregation document _id is not an allowed type');
        } else {
          doc_id = doc._id;
        }

        // If there are keys that should contain Mongo.ObjectIDs, validate them,
        // and if they fail validation because they are the wrong type of object id,
        // repair them back to being Mongo.ObjectIDs.
        if (schemaContext && (localOptions.objectIDKeysToRepair.length > 0)) {
          schemaContext.reset();
          schemaContext.validate(doc, { keys: localOptions.objectIDKeysToRepair });
          let validationErrors = schemaContext.validationErrors();
          validationErrors.forEach(error => {
            // error.dataType at this point has been converted to a string, so we can't
            // do a 100% positive confirmation that the expected type here was a
            // Mongo.ObjectID. This leaves open the (unimportant?) possibility that
            // a schema def with a "one of" definition of either a Mongo.ObjectID or
            // some other kind of ObjectID could cause this to repair the ObjectID
            // more than once. But repairObjectID only repairs the specific types
            // that a Mongo.ObjectID gets converted to, so some other unknown
            // ObjectID type won't be repaired.
            if ((error.type === _CircDepPreventionSimpleSchema.default.ErrorTypes.EXPECTED_TYPE) &&
              (error.dataType === "ObjectID")) {
              // error.name is the dotted path key to the objectID field.
              // Setting a dotted path element of an object requires code.
              repairObjectID(doc, error.name, error.value);
            }
          });
        }

        // If we got here, doc_id must be a string
        if (!sub._ids[doc_id]) {
          sub.added(localOptions.clientCollection, doc._id, doc);
        } else {
          if (sub._session.collectionViews instanceof Map) {
            // Since the pipeline fields might have been removed, we need to find the differences and define them as 'undefined' so the sub removes them.
            const previousFields = [...sub._session.collectionViews.get(localOptions.clientCollection).documents.get(doc_id).dataByKey.keys()];
            previousFields.forEach(field => {
              // At this point they are undefined because they no longer exist in the new doc, they're not literally set as undefined
              if (doc[field] === undefined) {
                // We need to explicitly define this as undefined so the sub will remove them.
                doc[field] = undefined;
              }
            });
          }
          sub.changed(localOptions.clientCollection, doc._id, doc);
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
      if (localOptions.capturePipeline) {
        localOptions.capturePipeline(docs);
      }
      sub.ready();           // Mark the subscription as ready
    } catch (err) {
      throw new TunguskaReactiveAggregateError(err.message);
    }
  }

  let currentDebounceCount = 0;
  let timer;

  const debounce = async (notification) => {
    if (initializing) return;
    if (localOptions.debug) console.log(`Reactive-Aggregate: collection ${notification.name}: publish: ${notification.mutation}, _id: ${notification.id}`)

    if (!timer && localOptions.debounceDelay > 0) timer = Meteor.setTimeout(async () => {
      await update();
      Meteor.clearTimeout(timer);
      timer = undefined;
      currentDebounceCount = 0;
    }, localOptions.debounceDelay);

    if (++currentDebounceCount >= localOptions.debounceCount) {
      await update();
      Meteor.clearTimeout(timer);
      timer = undefined;
      currentDebounceCount = 0;
    }
  }

  if (!localOptions.noAutomaticObserver) {
    const cursor = collection.find(localOptions.observeSelector, localOptions.observeOptions);
    localOptions.observers.push(cursor);
  }

  const handles = [];
  // Track any changes on the observed cursors.
  localOptions.observers.forEach(cursor => {
    const name = cursor._cursorDescription.collectionName;
    if (localOptions.debug) console.log(`Reactive-Aggregate: collection ${name}: initialise observers`)
    handles.push(cursor.observeChanges({
      async added(id) {
        await debounce({ name, mutation: 'added', id });
      },
      async changed(id) {
        await debounce({ name, mutation: 'changed', id });
      },
      async removed(id) {
        await debounce({ name, mutation: 'removed', id });
      },
      error(err) {
        throw new TunguskaReactiveAggregateError(err.message);
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
    const explain = await collection.rawCollection().aggregate(pipeline, localOptions.aggregationOptions).explain();
    localOptions.debug(explain);
  }

  initializing = false;  // Clear the initializing flag. From here, we're on autopilot
  await update();              // Send an initial result set to the client

};
