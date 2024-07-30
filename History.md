# Change History

## v2.0.1 2024-07-30

- Fix how observers are created.

## v2.0.0 2024-06-25

- Make code asynchronous.
- Allow pipeline parameter to be a function returning the pipeline. The pipeline will then be generated anew on each update triggered by observer changes.

## v1.3.16 2024-04-05

- Fixes (regression) error when documents are removed from collection

## v1.3.15 2024-03-04

- Fixes error when removing non-existing documents from collection
- Support for multiple ReactiveAggregates per subscription
- Ref https://github.com/robfallows/tunguska-reactive-aggregate/issues/76

## v1.3.14 2024-03-04

- Fixes a [regression issue](https://github.com/robfallows/tunguska-reactive-aggregate/issues/80).

## v1.3.13 2024-02-05

- Fixed errors being thrown when unsetting if documents do not exist as well as when using NO_MERGE publications strategy with client-only collection
- Ref: https://github.com/robfallows/tunguska-reactive-aggregate/issues/61

## v1.3.12 2024-01-02

- Cleanup the debounce timer when the subscription is stopped. This fixes error "Cannot read property 'documents' of undefined" reported [here](https://github.com/robfallows/tunguska-reactive-aggregate/issues/73) and [here](https://github.com/robfallows/tunguska-reactive-aggregate/issues/76)

## v1.3.11 2023-05-30

- Fixed issues:
  - [Cannot read property 'dataByKey' of undefined](https://github.com/robfallows/tunguska-reactive-aggregate/issues/74).
  - [Exception in changedobserveChanges callback: Error: Cannot read property 'documents' of undefined](https://github.com/robfallows/tunguska-reactive-aggregate/issues/73).

## v1.3.10 2022-10-25

- Fixed issue [Aggregation with $lookup](https://github.com/robfallows/tunguska-reactive-aggregate/issues/68) by using localOptions instead of options

## v1.3.9 2022-10-24

- Fixed issue with `_CircDepPreventionSimpleSchema` being undefined [Moved _CircDepPreventionSimpleSchema out of scope](https://github.com/robfallows/tunguska-reactive-aggregate/pull/71)

## v1.3.8 2022-06-06

- Added [options.specificWarnings](https://github.com/robfallows/tunguska-reactive-aggregate/pull/65)
- Added [options.loadObjectIdModules](https://github.com/robfallows/tunguska-reactive-aggregate/pull/66)

## v1.3.7 2022-01-18

- Fixing unset issue due to Meteor updating clientCollection to be Map instead of Object
 - Ref: [DDP Package Changes](meteor/meteor@79ae184#diff-173e69ea0353a765b98017d67abc45ec7ce1449178466dc74738324db83f9183)

## v1.3.6 2021-02-24

- Remediation release for v1.3.5 bug.
- Adds some more debug output when using `options.debug: true`.

## v1.3.5 2021-02-08

- The internal observer initialisation is now done asynchronously. :warning: **Do not use this version**. It has a serious performance bug when a publication is stopped and  restarted. Upgrade to v1.3.6 or downgrade to v1.3.4.

## v1.3.4 2021-01-06

- Allow capturing of pipeline output with new `options.pipelineCapture` parameter.

## v1.3.3 2020-09-02

- Allow opt-out of dependency warnings with new `options.warnings` parameter.

## v1.3.2 2020-04-27

- Display dependency warnings only once.

## v1.3.1 2020-03-27

- Addresses v1.3.0 issue #37 arising from circular require/import dependencies in user code. PR from @RealHandy.

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
