Package.describe({
  name: 'tunguska:reactive-aggregate',
  version: '2.0.1',
  summary: 'Publish aggregations reactively',
  git: 'https://github.com/robfallows/tunguska-reactive-aggregate',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom(['2.16', '3.0-rc.1']);
  api.use('mongo');
  api.use('ecmascript');
  api.mainModule('aggregate.js', 'server');
});
