import {
  getAdditionalServerOptions,
  getApplicationConfig,
  getApplicationId,
  getBasePath,
  getConfig,
  getExitOnUnhandledErrors,
  getHost,
  getITC,
  getLogLevel,
  getLogger,
  getPort,
  getRoot,
  getRuntimeConfig,
  getRuntimeBasePath,
  getTelemetryConfig,
  getWantsAbsoluteUrls,
  getWorkerId
} from '@platformatic/globals'
import { createServer } from 'node:http'

function handler (_, res) {
  res.writeHead(200, {
    'content-type': 'application/json',
    connection: 'close'
  })

  const platformatic = {
    additionalServerOptions: getAdditionalServerOptions(),
    applicationConfig: getApplicationConfig(),
    applicationId: getApplicationId(),
    basePath: getBasePath({ throwOnMissing: false }),
    config: getConfig(),
    exitOnUnhandledErrors: getExitOnUnhandledErrors(),
    host: getHost(),
    logLevel: getLogLevel(),
    logger: getLogger(),
    port: getPort(),
    root: getRoot(),
    runtimeConfig: getRuntimeConfig(),
    runtimeBasePath: getRuntimeBasePath(),
    telemetryConfig: getTelemetryConfig(),
    wantsAbsoluteUrls: getWantsAbsoluteUrls(),
    workerId: getWorkerId()
  }

  res.end(JSON.stringify(platformatic))
}

createServer(handler).listen({ host: '127.0.0.1', port: 0 })

const itc = getITC()
itc.notify('config', { production: process.env.NODE_ENV === 'production' })
