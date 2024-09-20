'use strict'
const process = require('node:process')
const opentelemetry = require('@opentelemetry/sdk-node')
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http')
const { Resource } = require('@opentelemetry/resources')
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions')
const setupTelemetry = require('./telemetry-config')

const setupNodeHTTPTelemetry = (opts, logger) => {
  const { serviceName } = opts
  logger.info(`Setting up Node.js HTTP telemetry for service: ${serviceName}`)
  // We setup the telemetry to init the spanProcessors, then we pass them to the SDK
  const { spanProcessors } = setupTelemetry(opts, logger)
  const sdk = new opentelemetry.NodeSDK({
    spanProcessors, // https://github.com/open-telemetry/opentelemetry-js/issues/4881#issuecomment-2358059714
    instrumentations: [
      new HttpInstrumentation(),
    ],
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName
    })
  })
  sdk.start()

  // gracefully shut down the SDK on process exit
  process.on('SIGTERM', () => {
    sdk.shutdown()
      .then(() => console.log('Tracing terminated'))
      .catch((error) => console.log('Error terminating tracing', error))
  })
}

module.exports = setupNodeHTTPTelemetry
