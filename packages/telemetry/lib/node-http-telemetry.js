'use strict'
const process = require('node:process')
const opentelemetry = require('@opentelemetry/sdk-node')
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http')
const { Resource } = require('@opentelemetry/resources')
const { initTelemetry } = require('./telemetry-config')
const { ATTR_SERVICE_NAME } = require('@opentelemetry/semantic-conventions')
const { workerData } = require('node:worker_threads')
const { resolve } = require('node:path')
const { tmpdir } = require('node:os')
const logger = require('abstract-logging')
const { statSync, readFileSync } = require('node:fs') // We want to have all this synch
const util = require('node:util')
const debuglog = util.debuglog('@platformatic/telemetry')

const setupNodeHTTPTelemetry = (opts) => {
  const { serviceName } = opts
  debuglog(`Setting up Node.js Open Telemetry instrumentation for service: ${serviceName}`)
  const { spanProcessors } = initTelemetry(opts, logger)
  const sdk = new opentelemetry.NodeSDK({
    spanProcessors, // https://github.com/open-telemetry/opentelemetry-js/issues/4881#issuecomment-2358059714
    instrumentations: [
      new HttpInstrumentation(),
    ],
    resource: new Resource({
      [ATTR_SERVICE_NAME]: serviceName
    })
  })
  sdk.start()

  process.on('SIGTERM', () => {
    sdk.shutdown()
      .then(() => debuglog('Tracing terminated'))
      .catch((error) => debuglog('Error terminating tracing', error))
  })
}

let data = null
const useWorkerData = !!workerData

if (useWorkerData) {
  data = workerData
} else if (process.env.PLT_MANAGER_ID) {
  try {
    const dataPath = resolve(tmpdir(), 'platformatic', 'runtimes', `${process.env.PLT_MANAGER_ID}.json`)
    statSync(dataPath)
    const jsonData = JSON.parse(readFileSync(dataPath, 'utf8'))
    data = jsonData.data
    debuglog(`Loaded data from ${dataPath}`)
  } catch (e) {
    debuglog('Error reading data from file %o', e)
  }
}

if (data) {
  debuglog('Setting up telemetry %o', data)
  const telemetryConfig = useWorkerData ? data?.serviceConfig?.telemetry : data?.telemetryConfig
  if (telemetryConfig) {
    debuglog('telemetryConfig %o', telemetryConfig)
    setupNodeHTTPTelemetry(telemetryConfig)
  }
}
