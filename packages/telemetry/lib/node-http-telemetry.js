'use strict'
const process = require('node:process')
const opentelemetry = require('@opentelemetry/sdk-node')
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http')
const { Resource } = require('@opentelemetry/resources')
const setupTelemetry = require('./telemetry-config')
const { ATTR_SERVICE_NAME } = require('@opentelemetry/semantic-conventions')
const { pino } = require('pino')
const { workerData } = require('node:worker_threads')
const { resolve } = require('node:path')
const { tmpdir } = require('node:os')
const { statSync, readFileSync } = require('node:fs') // We want to have ll this synch

const logger = pino()

const setupNodeHTTPTelemetry = (opts) => {
  const { serviceName } = opts
  logger.info(`Setting up Node.js Open Telemetry instrumentation for service: ${serviceName}`)
  const { spanProcessors } = setupTelemetry(opts, logger)
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
      .then(() => console.log('Tracing terminated'))
      .catch((error) => console.log('Error terminating tracing', error))
  })
}

let data = null
if (workerData) {
  data = workerData
} else if (process.env.PLT_MANAGER_ID) {
  try {
    const dataPath = resolve(tmpdir(), 'platformatic', 'runtimes', `${process.env.PLT_MANAGER_ID}.json`)
    statSync(dataPath)
    const { data: dataFromFile } = JSON.parse(readFileSync(dataPath))
    data = dataFromFile
  } catch (e) {}
}

// We have a service config, so we can setup telemetry if we have configuration
if (data) {
  const { id: serviceId } = workerData.serviceConfig
  let telemetryConfig = workerData.config.telemetry
  if (telemetryConfig) {
    telemetryConfig = {
      ...telemetryConfig,
      serviceName: `${telemetryConfig.serviceName}-${serviceId}`
    }
    setupNodeHTTPTelemetry(telemetryConfig)
  } else {
    logger.info(`No telemetry configuration found for service ${serviceId}`)
  }
}
