Package.describe({
  name: 'tunguska:reactive-aggregate',
  version: '1.3.7',
  summary: 'Publish aggregations reactively',
  git: 'https://github.com/robfallows/tunguska-reactive-aggregate',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.5');
  api.use('mongo');
  api.use('ecmascript');
  api.use('promise');
  api.mainModule('aggregate.js', 'server');
});
