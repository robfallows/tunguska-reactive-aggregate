# Change History

## v1.3.0 2020-03-09

- Adds support for Mongo.ObjectId ids (previously supported string ids). PR from @RealHandy.

## v1.2.3 2019-12-03

- Changes the way updates to docs with removed fields are handled. Kudos to @CyberCyclone.

## v1.2.2 2019-12-03

- This version should not (cannot) be used. The `meteor publish` hung and never completed, leaving this version in an unclean state.

## v1.2.1 2019-09-05

- Fixes an issue which delays the marking as `ready` of the publication.
- Adds a new option: `debug`, which provides basic console logging of the main stages and an initial insight into MongoDB's `explain` for the aggregation.

## v1.2.0 2019-08-15

- Fixes an issue in which MongoDb `ObjectId`s in the pipeline are apparently mutated into POJOs following `toArray()`. That mutation breaks minimongo. The fix applied in the release is to check each document's primary `_id` type and cast the result to a string, if necessary (and possible). All minimongo client document `_id`s are then of type `String`. Exceptions will be thrown for documents emitted from the pipeline with no `_id` field, or having an `_id` field not of type `String`, `Object` or `ObjectId`.
- Adds History.md (this file) for visibility of changes over time.

## v1.1.0 2019-06-26

- Deprecates `observeSelector` and `observeOptions`.
- Adds more error checking.
- Adds new options for:
  - `observers` - a list of observers across 0-n collections.
  - `noAutomaticObserver` - allows the disabling of the addition of an automatic observer on the primary collection.
  - `debounceCount` and `debounceDelay` - throttling controls for very active aggregation re-runs.

## v1.0.3 2018-02-01

- Fix for aggregation cursor not returning a Promise.

## v1.0.2 2017-11-07

- Changes to README.md.

## v1.0.1 2017-11-02

- Changes to README.md.
- Add some error handling.

## v1.0.0 2017-11-02

- Initial release:
  - Removes dependency on `meteorhacks:reactive-aggregate`.
  - Refactored for Promises and ES6/7 syntax.
