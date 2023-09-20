'use strict'

const FileWatcher = require('./lib/file-watcher')
const deepmerge = require('./lib/deepmerge')
const isKeyEnabled = require('./lib/is-key-enabled')
const createServerConfig = require('./lib/create-server-config')
const isFileAccessible = require('./lib/is-file-accessible')
const packages = require('./lib/packages')
const errors = require('./lib/errors')

module.exports.FileWatcher = FileWatcher
module.exports.deepmerge = deepmerge
module.exports.isKeyEnabled = isKeyEnabled
module.exports.isFileAccessible = isFileAccessible
module.exports.createServerConfig = createServerConfig
module.exports.hasDependency = packages.hasDependency
module.exports.getDependencyVersion = packages.getDependencyVersion
module.exports.getPlatformaticVersion = packages.getPlatformaticVersion
module.exports.checkForDependencies = packages.checkForDependencies

module.exports.errors = errors
