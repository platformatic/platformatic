'use strict'

const telemetry = require('./lib/telemetry')
const schema = require('./lib/schema')
const setupNodeHTTPTelemetry = require('./lib/node-http-telemetry')

module.exports = {
  telemetry,
  schema,
  setupNodeHTTPTelemetry
}
