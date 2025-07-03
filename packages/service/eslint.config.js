'use strict'

const neostandard = require('neostandard')

module.exports = neostandard({
  ts: true,
  ignores: [
    ...neostandard.resolveIgnoresFromGitignore(),
    'test/tmp/**/*',
    'test/fixtures/*/dist/**/*',
    '**/dist/*',
  ],
})
