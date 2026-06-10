import {
  getAdditionalServerOptions,
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
  getRuntimeBasePath,
  getTelemetryConfig,
  getWantsAbsoluteUrls,
  getWorkerId,
  isEntrypoint
} from '@platformatic/globals'
import { createServer } from 'node:http'

function handler (_, res) {
  res.writeHead(200, {
    'content-type': 'application/json',
    connection: 'close'
  })

  const platformatic = {
    additionalServerOptions: getAdditionalServerOptions(),
    applicationId: getApplicationId(),
    basePath: getBasePath({ throwOnMissing: false }),
    config: getConfig(),
    exitOnUnhandledErrors: getExitOnUnhandledErrors(),
    host: getHost(),
    isEntrypoint: isEntrypoint(),
    logLevel: getLogLevel(),
    logger: getLogger(),
    port: getPort(),
    root: getRoot(),
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
