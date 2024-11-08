'use strict'

const neostandard = require('neostandard')

module.exports = neostandard(
  {
    ignores: ['**/.next', '**/dist', '**/tmp', 'test/fixtures/**'],
  }
)
