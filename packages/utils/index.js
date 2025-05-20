'use strict'

const FileWatcher = require('./lib/file-watcher')
const findNearestString = require('./lib/find-nearest-string')
const deepmerge = require('./lib/deepmerge')
const isKeyEnabled = require('./lib/is-key-enabled')
const createServerConfig = require('./lib/create-server-config')
const { ensureFlushedWorkerStdio, disablePinoDirectWrite } = require('./lib/logging')
const isFileAccessible = require('./lib/is-file-accessible')
const packages = require('./lib/packages')
const { executeWithTimeout } = require('./lib/execute')
const errors = require('./lib/errors')
const features = require('./lib/features')
const getPkgManager = require('./lib/get-pkg-manager')
const match = require('./lib/match')
const { overridableValue, removeDefaults, omitProperties, ...schemaComponents } = require('./lib/schema')
const { createDirectory, safeRemove, generateDashedName } = require('./lib/directory')
const { withResolvers } = require('./lib/promises')
const { checkNodeVersionForServices } = require('./lib/check-node-version')
const { createRequire, loadModule } = require('./lib/modules')
const { getPrivateSymbol } = require('./lib/symbols')
const {
  buildPinoOptions,
  buildPinoFormatters,
  buildPinoTimestamp,
  setPinoFormatters,
  setPinoTimestamp
} = require('./lib/logger')

module.exports.FileWatcher = FileWatcher
module.exports.findNearestString = findNearestString
module.exports.deepmerge = deepmerge
module.exports.isKeyEnabled = isKeyEnabled
module.exports.isFileAccessible = isFileAccessible
module.exports.createServerConfig = createServerConfig
module.exports.hasDependency = packages.hasDependency
module.exports.getDependencyVersion = packages.getDependencyVersion
module.exports.getPlatformaticVersion = packages.getPlatformaticVersion
module.exports.checkForDependencies = packages.checkForDependencies
module.exports.getLatestNpmVersion = packages.getLatestNpmVersion
module.exports.getPkgManager = getPkgManager
module.exports.executeWithTimeout = executeWithTimeout
module.exports.errors = errors
module.exports.ensureLoggableError = errors.ensureLoggableError
module.exports.features = features
module.exports.match = match
module.exports.overridableValue = overridableValue
module.exports.removeDefaults = removeDefaults
module.exports.omitProperties = omitProperties
module.exports.schemaComponents = schemaComponents
module.exports.createDirectory = createDirectory
module.exports.safeRemove = safeRemove
module.exports.generateDashedName = generateDashedName
module.exports.withResolvers = withResolvers
module.exports.checkNodeVersionForServices = checkNodeVersionForServices
module.exports.createRequire = createRequire
module.exports.loadModule = loadModule
module.exports.getPrivateSymbol = getPrivateSymbol
module.exports.ensureFlushedWorkerStdio = ensureFlushedWorkerStdio
module.exports.disablePinoDirectWrite = disablePinoDirectWrite
module.exports.buildPinoOptions = buildPinoOptions
module.exports.setPinoFormatters = setPinoFormatters
module.exports.setPinoTimestamp = setPinoTimestamp
module.exports.buildPinoFormatters = buildPinoFormatters
module.exports.buildPinoTimestamp = buildPinoTimestamp
