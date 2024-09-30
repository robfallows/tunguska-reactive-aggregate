# tunguska-reactive-aggregate

Versions and recent changes

## Meteor 3.x

Use tunguska-reactive-aggregate v2.0.1

* Observers creation fix
* Added pipeline function parameter
* Made code async

## Meteor 2.x

Use tunguska-reactive-aggregate v1.3.16

* v1.3.16 fixes error when documents get removed from collection

## About

Reactively publish aggregations.

Originally based on `jcbernack:reactive-aggregate`.

This version removes the dependency on `meteorhacks:reactive-aggregate` and instead uses the underlying MongoDB Nodejs library. In addition, it uses ES6/7 coding, including Promises and `import/export` syntax, so should be `import`ed into your (server) codebase where it's needed.

In spite of those changes, the API is basically unchanged and is backwards compatible, as far as I know. However, there are several additional properties of the `options` parameter. See the notes in the **Usage** section.

Changed behaviour in v1.2.3: See <https://github.com/robfallows/tunguska-reactive-aggregate/issues/23> for more information.

## History

See [changelog](History.md).

`meteor add tunguska:reactive-aggregate`

This helper can be used to reactively publish the results of an aggregation.

## Mongo.ObjectID support

If your collections use the Meteor default of String for MongoDB document ids, you can skip this section and may want to set `options.specificWarnings.objectId = false` and `options.loadObjectIdModules = false`

However, if you use the Mongo.ObjectID type for document ids, full support for handling Mongo.ObjectIDs is only enabled if `simpl-schema` and either `lodash-es` or `lodash` are installed. For backward compatibility, they are not required. (Only the `set` functionality of `lodash-es`/`lodash` is imported, if you're concerned about the full package bloating your code size).

You can install them in your project with:

`meteor npm i simpl-schema`

`meteor npm i lodash-es` or `meteor npm i lodash`

Additionally, unless you have defined SimpleSchemas for your collections, you still won't have full support for handling Mongo.ObjectIDs. The `_id` field of your primary collection _will_ be handled properly without installing these packages and without having SimpleSchemas defined, but any embedded Mongo.ObjectID fields will _not_ be handled properly unless you set up full support with these packages and schema definitions. Defining SimpleSchemas is beyond the scope of this writeup, but you can learn about it at [simple-schema on GitHub](https://github.com/aldeed/simple-schema-js).

If you're curious about why Mongo.ObjectIDs require special support at all, it's because in Meteor, aggregate must use the low-level MongoDB Nodejs library, which doesn't know the Mongo.ObjectID type and so performs conversions that break Mongo.ObjectIDs. That's what 'full support' here is working around.

## Usage

```js
import { ReactiveAggregate } from 'meteor/tunguska:reactive-aggregate';

Meteor.publish('nameOfPublication', function() {
  ReactiveAggregate(context, collection, pipeline, options);
});
```

- `context` should always be `this` in a publication.
- `collection` is the Mongo.Collection instance to query. To preserve backwards compatibility, an observer is automatically added on this collection, unless `options.noAutomaticObserver` is set to `true`.

  The backwards-compatible options `observeSelector` and `observeOptions` are now **deprecated**, but will continue to be honoured on an automatically added observer. However, the recommended approach is to set `options.noAutomaticObserver` to `true` and define your own oberver(s) in `options.observers`. There is no guarantee that deprecated options will continue to be honoured in future releases.

- `pipeline` is the aggregation pipeline to execute or a function that returns the aggregation pipeline. If a function is provided, it will be called before updates triggered by the observers. 
- `options` provides further options:
  - `aggregationOptions` can be used to add further, aggregation-specific options. See [standard aggregation options](http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#aggregate) for more information. The additional aggregation options shown in this example are not necessarily sane!

    ```js
      ReactiveAggregate(this, collection, pipeline, {
        aggregationOptions: { maxTimeMS: 500, bypassDocumentValidation: true },
      });
    ```

  - `capturePipeline`: A callback function having one parameter which will return the array of documents comprising the the current pipeline execution. :warning: Use with caution: this callback will be executed each time the pipeline re-runs.

    ```js
      ReactiveAggregate(this, collection, pipeline, {
        capturePipeline(docs) {
          console.log(docs);
        },
      });
    ```

  - `clientCollection` defaults to the same name as the original collection, but can be overridden to send the results to a differently named client-side collection.

    ```js
      ReactiveAggregate(this, collection, pipeline, {
        clientCollection: "clientCollectionName",
      });
    ```

  - `debounceCount`: An integer representing the number of observer changes across all observers before the aggregation will be re-run. Defaults to 0 (do not count) for backwards compatibility with the original API. Used in conjunction with `debounceDelay` to fine-tune reactivity. The first of the two debounce options to be reached will re-run the aggregation.
  - `debounceDelay`: An integer representing the maximum number of milli-seconds to wait for observer changes before the aggregation is re-run. Defaults to 0 (do not wait) for backwards compatibility with the original API. Used in conjunction with `debounceCount` to fine-tune reactivity. The first of the two debounce options to be reached will re-run the aggregation.
  - `debug`: A boolean (`true` or `false`), or a callback function having one parameter which will return the `aggregate#cursor.explain()` result. Defaults to `false` (no debugging).
  - `objectIDKeysToRepair`: An array of SimpleSchema-style dotted path keys to fields of the schema that are Mongo.ObjectIDs. This _is not needed by default_ and _should not be used unless the default behaviour of the code fails in some way_. If your schemas use Mongo.ObjectID or Mongo.Collection.ObjectID as the type for object ids, rather than the Meteor default strings, and the code does not automatically handle your object ids properly (which may happen in rare cases, based on your schemas), then you can specify schema keys here to tell the code that they are Mongo.ObjectIDs as an alternative way to get your schemas to aggregate and return properly typed object ids. For example, if your BlogPosts collection schema has a `parentID` key that contains the object id of a parent post, and it also has a `comments` field that is an array of objects, one field of which, `id`, is a Mongo.ObjectID of a comment document in another collection, then _if your aggregations don't return properly typed Mongo.ObjectIDs in those fields automatically_, you could try providing  ['parentID', 'comments.$.id']. But this is a last resort, and you should expect your aggregations to return Mongo.ObjectID values properly, including the `_id` of your primary collection. Defaults to `[]`.
  - `noAutomaticObserver`: set this to `true` to prevent the backwards-compatible behaviour of an observer on the given collection.
  - `observers`: An array of cursors. Each cursor is the result of a `Collection.find()`. Each of the supplied cursors will have an observer attached, so any change detected (based on the selection criteria in the `find`) will re-run the aggregation pipeline.
  - `loadObjectIdModules`: A boolean (`true` or `false`) that if true, tries to load modules necessary for ObjectId support. Defaults to `true`.
  - `warnings`: A boolean (`true` or `false`) that if false, suppresses all warnings, regardless of any specificWarnings. Defaults to `true` (warning messages are logged).
  - `specificWarnings` object, allows you to suppress specific types of warnings: (they all default to `true`, warning messages are logged)
    - `deprecations`: Warnings about deprecations.
    - `objectId`: Warnings related to ObjectID and dependencies for using it.

  :hand: The following parameters are **deprecated** and will be removed in a later version. Both these parameters are now effectively absorbed into the `observers` option and if required should be replaced by adding a cursor (or cursors) to the array of cursors in `observers`. Setting either of these to anything other than the empty object `{}` will result in a deprecation notice to the server console (for example: `tunguska:reactive-aggregate: observeSelector is deprecated`).
  - ~~`observeSelector`~~ can be given to improve efficiency. This selector is used for observing the collection.
  (e.g. `{ authorId: { $exists: 1 } }`)
  - ~~`observeOptions`~~ can be given to limit fields, further improving efficiency. Ideally used to limit fields on your query.
  If none are given any change to the collection will cause the aggregation to be re-evaluated.
  (e.g. `{ limit: 10, sort: { createdAt: -1 } }`)

## Quick Example

A publication for one of the
[examples](https://docs.mongodb.org/v3.0/reference/operator/aggregation/group/#group-documents-by-author)
in the MongoDB docs would look like this:

```js
Meteor.publish("booksByAuthor", function () {
  ReactiveAggregate(this, Books, [{
    $group: {
      _id: "$author",
      books: { $push: "$$ROOT" }
    }
  }]);
});
```

## Extended Example

Define the parent collection you want to run an aggregation on. Let's say:

```js
import { Mongo } from 'meteor/mongo';
export const Reports = new Mongo.Collection('Reports');
```

...in a location where all your other collections are defined, say `/imports/both/Reports.js`

Next, prepare to publish the aggregation on the `Reports` collection into another client-side-only collection we'll call `clientReport`.

Create the `clientReport` in the client (it's needed only for client use). This collection will be the destination into which the aggregation will be put upon completion.

Publish the aggregation on the server:

```js
Meteor.publish("reportTotals", function() {
  ReactiveAggregate(this, Reports, [{
    // assuming our Reports collection have the fields: hours, books
    $group: {
      '_id': this.userId,
      'hours': {
      // In this case, we're running summation.
        $sum: '$hours'
      },
      'books': {
        $sum: 'books'
      }
    }
  }, {
    $project: {
      // an id can be added here, but when omitted,
      // it is created automatically on the fly for you
      hours: '$hours',
      books: '$books'
    } // Send the aggregation to the 'clientReport' collection available for client use by using the clientCollection property of options.
  }], { clientCollection: 'clientReport' });
});
```

Subscribe to the above publication on the client:

```js
import { Mongo } from 'meteor/mongo';

// Define a named, client-only collection, matching the publication's clientCollection.
const clientReport = new Mongo.Collection('clientReport');

Template.statsBrief.onCreated(function() {
  // subscribe to the aggregation
  this.subscribe('reportTotals');

// Then in our Template helper:

Template.statsBrief.helpers({
  reportTotals() {
    return clientReport.find();
  },
});
```

Finally, in your template:

```handlebars
{{#each report in reportTotals}}
  <div>Total Hours: {{report.hours}}</div>
  <div>Total Books: {{report.books}}</div>
{{/each}}
```

Your aggregated values will therefore be available in the client and behave reactively just as you'd expect.

## Using `$lookup`

The use of `$lookup` in an aggregation pipeline introduces the eventuality that the aggregation pipeline will need to re-run when any or all of the collections involved in the aggregation change.

By default, only the base collection is observed for changes. However, it's possible to specify an arbitrary number of observers on disparate collections. In fact, it's possible to observe a collection which is not part of the aggregation pipeline to trigger a re-run of the aggregation. This introduces some interesting approaches towards optimising "heavy" pipelines on very active collections (although perhaps you shouldn't be doing that in the first place :wink:).

```js
Meteor.publish("biographiesByWelshAuthors", function () {
  ReactiveAggregate(this, Authors, [{
    $lookup: {
      from: "books",
      localField: "_id",
      foreignField: "author_id",
      as: "author_books"
    }
  }], {
    noAutomaticObserver: true,
    debounceCount: 100,
    debounceDelay: 100,
    observers: [
      Authors.find({ nationality: 'welsh'}),
      Books.find({ category: 'biography' })
    ]
  });
});
```

The aggregation will re-run whenever there is a change to the "welsh" authors in the `authors` collection or if there is a change to the biographies in the `books` collection.

The `debounce` parameters were specified, so any changes will only be made available to the client when 100 changes have been seen across both collections (in total), or after 100ms, whichever occurs first.

## Non-Reactive Aggregations

Like a Meteor Method, but the results come back in a Minimongo collection.

```js
Meteor.publish("biographiesByWelshAuthors", function () {
  ReactiveAggregate(this, Authors, [{
    $lookup: {
      from: "books",
      localField: "_id",
      foreignField: "author_id",
      as: "author_books"
    }
  }], {
    noAutomaticObserver: true
  });
});
```

No observers were specified and `noAutomaticObserver` was enabled, so the publication runs once only.

## On-Demand Aggregations

Also like a Meteor Method, but the results come back in a Minimongo collection and re-running of the aggregation can be triggered by observing an arbitrary, independent collection.

```js
Meteor.publish("biographiesByWelshAuthors", function () {
  ReactiveAggregate(this, Authors, [{
    $lookup: {
      from: "books",
      localField: "_id",
      foreignField: "author_id",
      as: "author_books"
    }
  }], {
    noAutomaticObserver: true,
    observers: [
      Reruns.find({ _id: 'welshbiographies' })
    ]
  });
});
```

By mutating the `Reruns` collection on a specific `_id` we cause the aggregation to re-run. The mutation could be done using a Meteor Method, or using Meteor's pub/sub.

---

Enjoy aggregating reactively, but use sparingly. Remember, with great reactivity comes great responsibility!
