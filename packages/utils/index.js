'use strict'

const { checkNodeVersionForServices } = require('./lib/check-node-version')
const { createServerConfig } = require('./lib/create-server-config')
const { deepmerge } = require('./lib/deepmerge')
const { createDirectory, createTemporaryDirectory, generateDashedName, safeRemove } = require('./lib/directory')
const { PathOptionRequiredError, ensureLoggableError } = require('./lib/errors')
const { executeWithTimeout, kTimeout } = require('./lib/execute')
const { features } = require('./lib/features')
const { FileWatcher } = require('./lib/file-watcher')
const { findNearestString } = require('./lib/find-nearest-string')
const { getPkgManager } = require('./lib/get-pkg-manager')
const { isFileAccessible } = require('./lib/is-file-accessible')
const { isKeyEnabled } = require('./lib/is-key-enabled')
const { parseMemorySize } = require('./lib/parse')
const {
  abstractLogger,
  buildPinoFormatters,
  buildPinoOptions,
  buildPinoTimestamp,
  setPinoFormatters,
  setPinoTimestamp
} = require('./lib/logger')
const { disablePinoDirectWrite, ensureFlushedWorkerStdio } = require('./lib/logging')
const { escapeRegexp, match } = require('./lib/match')
const { kFailedImport, loadModule } = require('./lib/modules')
const {
  detectApplicationType,
  getDependencyVersion,
  getLatestNpmVersion,
  getPlatformaticVersion,
  hasDependency,
  hasFilesWithExtensions,
  hasJavascriptFiles,
  searchFilesWithExtensions,
  searchJavascriptFiles
} = require('./lib/packages')
const { withResolvers } = require('./lib/promises')
const { omitProperties, overridableValue, removeDefaults, ...schemaComponents } = require('./lib/schema')
const { getPrivateSymbol } = require('./lib/symbols')

module.exports.abstractLogger = abstractLogger
module.exports.buildPinoFormatters = buildPinoFormatters
module.exports.buildPinoOptions = buildPinoOptions
module.exports.buildPinoTimestamp = buildPinoTimestamp
module.exports.checkNodeVersionForServices = checkNodeVersionForServices
module.exports.createDirectory = createDirectory
module.exports.createTemporaryDirectory = createTemporaryDirectory
module.exports.createServerConfig = createServerConfig
module.exports.deepmerge = deepmerge
module.exports.detectApplicationType = detectApplicationType
module.exports.disablePinoDirectWrite = disablePinoDirectWrite
module.exports.ensureFlushedWorkerStdio = ensureFlushedWorkerStdio
module.exports.ensureLoggableError = ensureLoggableError
module.exports.errors = { PathOptionRequiredError }
module.exports.escapeRegexp = escapeRegexp
module.exports.executeWithTimeout = executeWithTimeout
module.exports.features = features
module.exports.FileWatcher = FileWatcher
module.exports.findNearestString = findNearestString
module.exports.generateDashedName = generateDashedName
module.exports.getDependencyVersion = getDependencyVersion
module.exports.getLatestNpmVersion = getLatestNpmVersion
module.exports.getPkgManager = getPkgManager
module.exports.getPlatformaticVersion = getPlatformaticVersion
module.exports.getPrivateSymbol = getPrivateSymbol
module.exports.hasDependency = hasDependency
module.exports.hasFilesWithExtensions = hasFilesWithExtensions
module.exports.hasJavascriptFiles = hasJavascriptFiles
module.exports.isFileAccessible = isFileAccessible
module.exports.isKeyEnabled = isKeyEnabled
module.exports.kFailedImport = kFailedImport
module.exports.kTimeout = kTimeout
module.exports.loadModule = loadModule
module.exports.match = match
module.exports.omitProperties = omitProperties
module.exports.overridableValue = overridableValue
module.exports.removeDefaults = removeDefaults
module.exports.safeRemove = safeRemove
module.exports.schemaComponents = schemaComponents
module.exports.searchFilesWithExtensions = searchFilesWithExtensions
module.exports.searchJavascriptFiles = searchJavascriptFiles
module.exports.setPinoFormatters = setPinoFormatters
module.exports.setPinoTimestamp = setPinoTimestamp
module.exports.withResolvers = withResolvers
module.exports.parseMemorySize = parseMemorySize
