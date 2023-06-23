'use strict'
const { buildServer } = require('./lib/build-server')
const { platformaticRuntime } = require('./lib/config')
const { start } = require('./lib/start')
const unifiedApi = require('./lib/unified-api')
const RuntimeApi = require('./lib/api')

module.exports.buildServer = buildServer
module.exports.platformaticRuntime = platformaticRuntime
module.exports.schema = platformaticRuntime.schema
module.exports.RuntimeApi = RuntimeApi
module.exports.start = start
module.exports.unifiedApi = unifiedApi
