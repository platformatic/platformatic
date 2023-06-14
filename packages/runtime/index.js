'use strict'
const { buildServer } = require('./lib/build-server')
const { platformaticRuntime } = require('./lib/config')
const { start } = require('./lib/start')
const unifiedApi = require('./lib/unified-api')

module.exports = {
  buildServer,
  platformaticRuntime,
  schema: platformaticRuntime.schema,
  start,
  unifiedApi
}
