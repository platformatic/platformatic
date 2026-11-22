export default {
  extensions: [
    { path: '../extension-configure.js', options: { value: 'first' } },
    { path: '../extension-configure.js', options: { value: '-second' } }
  ],
  autoload: { path: '../services', exclude: ['b', 'crash-on-start'] },
  logger: { level: 'silent' }
}
