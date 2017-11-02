# meteor-reactive-aggregate

Reactively publish aggregations.

    meteor add tunguska:reactive-aggregate

This helper can be used to reactively publish the results of an aggregation.

Based on `jcbernack:reactive-aggregate`.

This clone removes the dependency on `meteorhacks:reactive-aggregate` and instead uses the underlying MongoDB Nodejs library. In addition, it uses ES6/7 coding, including `async` and `await` and `import/export` syntax, so should be `import`ed into your (server) codebase where it's needed.

In spite of those changes, the API is basically unchanged. I have added a new `aggregationOptions` object to the `options`, which may be used to pass in any of the [standard aggregation options](http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#aggregate).

## Usage

```js
import { ReactiveAggregate } from 'meteor/tunguska:reactive-aggregate';

Meteor.publish('nameOfPublication', function() {
  ReactiveAggregate(sub, collection, pipeline, options);
});
```

- `sub` should always be `this` in a publication.
- `collection` is the Mongo.Collection instance to query.
- `pipeline` is the aggregation pipeline to execute.
- `options` provides further options:
  - `aggregationOptions` can be used to add further, aggregation-specific options. See [standard aggregation options](http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#aggregate) for more information.
  - `observeSelector` can be given to improve efficiency. This selector is used for observing the collection.
  (e.g. `{ authorId: { $exists: 1 } }`)
  - `observeOptions` can be given to limit fields, further improving efficiency. Ideally used to limit fields on your query.
  If none are given any change to the collection will cause the aggregation to be re-evaluated.
  (e.g. `{ limit: 10, sort: { createdAt: -1 } }`)
  - `clientCollection` defaults to the same name as the original collection, but can be overridden to send the results to a differentley named client-side collection.

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

Create the `clientReport` in the client side (it's needed only for client use). This collection will be the destination into which the aggregation will be put upon completion.

Publish the aggregation on the server:

```js
Meteor.publish("reportTotals", function() {
  // Remember, ReactiveAggregate doesn't return anything
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

```hb
{{#each report in reportTotals}}
  <div>Total Hours: {{report.hours}}</div>
  <div>Total Books: {{report.books}}</div>
{{/each}}
```

Your aggregated values will therefore be available in client-side and behave reactively just as you'd expect.

Enjoy aggregating `reactively`!
