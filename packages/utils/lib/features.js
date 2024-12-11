'use strict'

const { platform } = require('node:os')
const { satisfies } = require('semver')

const currentPlatform = platform()

const node = {
  reusePort: satisfies(process.version, '^22.12.0 || ^23.1.0') && !['win32', 'darwin'].includes(currentPlatform)
}

module.exports = { node }
