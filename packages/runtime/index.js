'use strict'
const { buildServer } = require('./lib/build-server')
const { platformaticRuntime } = require('./lib/config')
const { start } = require('./lib/start')
const unifiedApi = require('./lib/unified-api')
const RuntimeApi = require('./lib/api')
const { compile } = require('./lib/compile')

module.exports.buildServer = buildServer
module.exports.platformaticRuntime = platformaticRuntime
module.exports.schema = platformaticRuntime.schema
module.exports.RuntimeApi = RuntimeApi
module.exports.start = start
module.exports.unifiedApi = unifiedApi
module.exports.compile = compile
