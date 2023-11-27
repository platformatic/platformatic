'use strict'
const { buildServer } = require('./lib/build-server')
const { platformaticRuntime } = require('./lib/config')
const { start, startCommand } = require('./lib/start')
const RuntimeApi = require('./lib/api')
const { compile } = require('./lib/compile')
const { loadConfig } = require('./lib/load-config')
const errors = require('./lib/errors')
const RuntimeGenerator = require('./lib/generator/runtime-generator')

module.exports.buildServer = buildServer
module.exports.platformaticRuntime = platformaticRuntime
module.exports.schema = platformaticRuntime.schema
module.exports.RuntimeApi = RuntimeApi
module.exports.start = start
module.exports.startCommand = startCommand
module.exports.compile = compile
module.exports.loadConfig = loadConfig
module.exports.errors = errors
module.exports.Generator = RuntimeGenerator
