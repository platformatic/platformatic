'use strict'

const { buildServer } = require('./lib/build-server')
const errors = require('./lib/errors')
const { platformaticRuntime, wrapConfigInRuntimeConfig } = require('./lib/config')
const { RuntimeGenerator, WrappedGenerator } = require('./lib/generator/runtime-generator')
const { Runtime } = require('./lib/runtime')
const { buildRuntime, start, startCommand } = require('./lib/start')
const symbols = require('./lib/worker/symbols')
const { loadConfig, getRuntimeLogsDir } = require('./lib/utils')

const platformaticVersion = require('./package.json').version

module.exports.buildServer = buildServer
module.exports.buildRuntime = buildRuntime
module.exports.errors = errors
module.exports.Generator = RuntimeGenerator
module.exports.WrappedGenerator = WrappedGenerator
module.exports.getRuntimeLogsDir = getRuntimeLogsDir
module.exports.loadConfig = loadConfig
module.exports.platformaticRuntime = platformaticRuntime
module.exports.schema = platformaticRuntime.schema
module.exports.start = start
module.exports.startCommand = startCommand
module.exports.symbols = symbols
module.exports.Runtime = Runtime
module.exports.wrapConfigInRuntimeConfig = wrapConfigInRuntimeConfig
module.exports.version = platformaticVersion
