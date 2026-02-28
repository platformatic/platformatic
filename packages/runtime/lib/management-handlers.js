import {
  applications as applicationSchema,
  kMetadata,
  validate
} from '@platformatic/foundation'
import { prepareApplication } from './config.js'

const allOperations = [
  'getRuntimeStatus',
  'getRuntimeMetadata',
  'getRuntimeConfig',
  'getRuntimeEnv',
  'getApplicationsIds',
  'getApplications',
  'getWorkers',
  'getApplicationDetails',
  'getApplicationConfig',
  'getApplicationEnv',
  'getApplicationOpenapiSchema',
  'getApplicationGraphqlSchema',
  'getMetrics',
  'startApplication',
  'stopApplication',
  'restartApplication',
  'restart',
  'addApplications',
  'removeApplications',
  'inject'
]

export function createManagementHandlers (runtime, allowedOperations) {
  const allowed = allowedOperations
    ? new Set(allowedOperations)
    : new Set(allOperations)

  const handlers = new Map()

  function register (name, fn) {
    if (allowed.has(name)) {
      handlers.set('management:' + name, fn)
    }
  }

  // Read operations - no arguments
  register('getRuntimeStatus', async () => {
    return runtime.getRuntimeStatus()
  })

  register('getRuntimeMetadata', async () => {
    return runtime.getRuntimeMetadata()
  })

  register('getRuntimeConfig', async () => {
    return runtime.getRuntimeConfig()
  })

  register('getRuntimeEnv', async () => {
    return runtime.getRuntimeEnv()
  })

  register('getApplicationsIds', async () => {
    return runtime.getApplicationsIds()
  })

  register('getApplications', async () => {
    return runtime.getApplications()
  })

  register('getWorkers', async () => {
    return runtime.getWorkers()
  })

  // Read operations - with application id
  register('getApplicationDetails', async ({ id }) => {
    return runtime.getApplicationDetails(id)
  })

  register('getApplicationConfig', async ({ id }) => {
    return runtime.getApplicationConfig(id)
  })

  register('getApplicationEnv', async ({ id }) => {
    return runtime.getApplicationEnv(id)
  })

  register('getApplicationOpenapiSchema', async ({ id }) => {
    return runtime.getApplicationOpenapiSchema(id)
  })

  register('getApplicationGraphqlSchema', async ({ id }) => {
    return runtime.getApplicationGraphqlSchema(id)
  })

  // Metrics
  register('getMetrics', async ({ format } = {}) => {
    return runtime.getMetrics(format)
  })

  // Write operations
  register('startApplication', async ({ id }) => {
    await runtime.startApplication(id)
  })

  register('stopApplication', async ({ id }) => {
    await runtime.stopApplication(id)
  })

  register('restartApplication', async ({ id }) => {
    await runtime.restartApplication(id)
  })

  register('restart', async ({ applications } = {}) => {
    return runtime.restart(applications)
  })

  register('addApplications', async ({ applications, start }) => {
    const config = runtime.getRuntimeConfig(true)

    validate(applicationSchema, applications, {}, true, config[kMetadata].root)

    for (let i = 0; i < applications.length; i++) {
      applications[i] = await prepareApplication(config, applications[i], config.workers)
    }

    return runtime.addApplications(applications, start)
  })

  register('removeApplications', async ({ ids }) => {
    return runtime.removeApplications(ids)
  })

  register('inject', async ({ id, injectParams }) => {
    return runtime.inject(id, injectParams)
  })

  return handlers
}

export { allOperations }
