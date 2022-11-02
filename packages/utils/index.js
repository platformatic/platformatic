'use strict'

const FileWatcher = require('./lib/file-watcher')
const deepmerge = require('./lib/deepmerge')
const isKeyEnabled = require('./lib/is-key-enabled')

module.exports = { FileWatcher, deepmerge, isKeyEnabled }
