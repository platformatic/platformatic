'use strict'

const { buildServer } = require('./lib/build-server')
const { compile } = require('./lib/compile')
const errors = require('./lib/errors')
const { platformaticRuntime, wrapConfigInRuntimeConfig } = require('./lib/config')
const RuntimeGenerator = require('./lib/generator/runtime-generator')
const { Runtime } = require('./lib/runtime')
const { start, startCommand } = require('./lib/start')
const symbols = require('./lib/worker/symbols')
const { loadConfig, getRuntimeLogsDir } = require('./lib/utils')

module.exports.buildServer = buildServer
module.exports.compile = compile
module.exports.errors = errors
module.exports.Generator = RuntimeGenerator
module.exports.getRuntimeLogsDir = getRuntimeLogsDir
module.exports.loadConfig = loadConfig
module.exports.platformaticRuntime = platformaticRuntime
module.exports.schema = platformaticRuntime.schema
module.exports.start = start
module.exports.startCommand = startCommand
module.exports.symbols = symbols
module.exports.Runtime = Runtime
module.exports.wrapConfigInRuntimeConfig = wrapConfigInRuntimeConfig
