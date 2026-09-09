/*
  An application that already has a configuration. The marker below is what the tests look for
  afterwards: `import` must leave this file exactly as it found it. It is a valid configuration
  because the project has to load for the command to reach the file at all.
*/
export default {
  // marker: do not rewrite
  module: '@platformatic/node',
  node: {
    main: 'index.js'
  }
}
