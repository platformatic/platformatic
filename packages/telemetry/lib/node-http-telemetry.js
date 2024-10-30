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
const { statSync, readFileSync } = require('node:fs') // We want to have all this synch

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
const useWorkerData = !!workerData

if (useWorkerData) {
  data = workerData
} else if (process.env.PLT_MANAGER_ID) {
  try {
    const dataPath = resolve(tmpdir(), 'platformatic', 'runtimes', `${process.env.PLT_MANAGER_ID}.json`)
    statSync(dataPath)
    const jsonData = JSON.parse(readFileSync(dataPath, 'utf8'))
    data = jsonData.data
    logger.debug(`Loaded data from ${dataPath}`)
  } catch (e) {
    logger.error('Error reading data from file', e)
  }
}

if (data) {
  const telemetryConfig = useWorkerData ? data.serviceConfig.telemetry : data.telemetryConfig
  const serviceId = useWorkerData ? data.serviceConfig.id : data.id
  logger.debug({ telemetryConfig }, 'telemetryConfig')
  if (telemetryConfig) {
    setupNodeHTTPTelemetry(telemetryConfig)
  } else {
    logger.debug({ serviceId }, 'No telemetry configuration found')
  }
}
