Package.describe({
  name: 'tunguska:reactive-aggregate',
  version: '2.0.0',
  summary: 'Publish aggregations reactively',
  git: 'https://github.com/robfallows/tunguska-reactive-aggregate',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom(['2.16', '3.0-rc.0']);
  api.use('mongo');
  api.use('ecmascript');
  api.use('promise');
  api.mainModule('aggregate.js', 'server');
});
