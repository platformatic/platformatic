import { ensureLoggableError, executeInParallel, executeWithTimeout, kTimeout } from '@platformatic/foundation'
import { ITC } from '@platformatic/itc'
import { Unpromise } from '@watchable/unpromise'
import { once } from 'node:events'
import { parentPort, workerData } from 'node:worker_threads'
import {
  ApplicationExitedError,
  FailedToPerformCustomHealthCheckError,
  FailedToPerformCustomReadinessCheckError,
  FailedToRetrieveGraphQLSchemaError,
  FailedToRetrieveHealthError,
  FailedToRetrieveMetaError,
  FailedToRetrieveMetricsError,
  FailedToRetrieveOpenAPISchemaError,
  WorkerExitedError
} from '../errors.js'
import { updateUndiciInterceptors } from './interceptors.js'
import { MessagingITC } from './messaging.js'
import { kApplicationId, kITC, kId, kWorkerId } from './symbols.js'

async function safeHandleInITC (worker, fn) {
  try {
    // Make sure to catch when the worker exits, otherwise we're stuck forever
    const ac = new AbortController()
    let exitCode

    const response = await Unpromise.race([
      fn(),
      once(worker, 'exit', { signal: ac.signal }).then(([code]) => {
        exitCode = code
      })
    ])

    if (typeof exitCode === 'number') {
      if (typeof worker[kWorkerId] !== 'undefined') {
        throw new WorkerExitedError(worker[kWorkerId], worker[kApplicationId], exitCode)
      } else {
        throw new ApplicationExitedError(worker[kId], exitCode)
      }
    } else {
      ac.abort()
    }

    return response
  } catch (error) {
    if (!error.handlerError) {
      throw error
    }

    if (error.handlerErrorCode && !error.handlerError.code) {
      error.handlerError.code = error.handlerErrorCode
    }

    throw error.handlerError
  }
}

async function closeITC (dispatcher, itc, messaging) {
  await dispatcher.interceptor.close()
  itc.close()
  messaging.close()
}

export async function sendViaITC (worker, name, message, transferList) {
  return safeHandleInITC(worker, () => worker[kITC].send(name, message, { transferList }))
}

export async function sendMultipleViaITC (
  idsAndWorkerPairs,
  name,
  message,
  transferList,
  concurrency,
  timeout = 5000,
  timeoutFallbackValue = kTimeout
) {
  const results = await executeInParallel(
    async (id, worker) => {
      return [
        id,
        await executeWithTimeout(sendViaITC(worker, name, message, transferList), timeout, timeoutFallbackValue)
      ]
    },
    idsAndWorkerPairs,
    concurrency
  )

  return Object.fromEntries(results)
}

export async function waitEventFromITC (worker, event) {
  return safeHandleInITC(worker, () => once(worker[kITC], event))
}

export function setupITC (controller, application, dispatcher, sharedContext) {
  const logger = globalThis.platformatic.logger
  const messaging = new MessagingITC(controller.applicationConfig.id, workerData.config, logger)

  Object.assign(globalThis.platformatic ?? {}, {
    messaging: {
      handle: messaging.handle.bind(messaging),
      send: messaging.send.bind(messaging),
      notify: messaging.notify.bind(messaging)
    }
  })

  const itc = new ITC({
    name: controller.applicationConfig.id + '-worker',
    port: parentPort,
    handlers: {
      async start () {
        const status = controller.getStatus()

        if (status === 'starting') {
          await once(controller, 'start')
        } else {
          // This gives a chance to a capability to perform custom logic
          globalThis.platformatic.events.emit('start')

          try {
            await controller.start()
          } catch (e) {
            await controller.stop(true)

            // Reply to the runtime that the start failed, so it can cleanup
            once(itc, 'application:worker:start:processed').then(() => {
              closeITC(dispatcher, itc, messaging).catch(() => {})
            })

            throw ensureLoggableError(e)
          }
        }

        if (application.entrypoint) {
          await controller.listen()
        }

        dispatcher.replaceServer(await controller.capability.getDispatchTarget())
        return application.entrypoint ? controller.capability.getUrl() : null
      },

      async stop ({ force, dependents }) {
        const status = controller.getStatus()

        if (!force && status === 'starting') {
          await once(controller, 'start')
        }

        if (force || status.startsWith('start')) {
          // This gives a chance to a capability to perform custom logic
          globalThis.platformatic.events.emit('stop')

          await controller.stop(force, dependents)
        }

        once(itc, 'application:worker:stop:processed').then(() => {
          closeITC(dispatcher, itc, messaging).catch(() => {})
        })
      },

      async build () {
        return controller.capability.build()
      },

      async removeFromMesh () {
        return dispatcher.interceptor.close()
      },

      inject (injectParams) {
        return controller.capability.inject(injectParams)
      },

      async updateUndiciInterceptors (undiciConfig) {
        await updateUndiciInterceptors(undiciConfig)
      },

      async updateWorkersCount (data) {
        const { workers } = data
        workerData.applicationConfig.workers = workers
        workerData.worker.count = workers
      },

      getStatus () {
        return controller.getStatus()
      },

      getApplicationInfo () {
        return controller.capability.getInfo()
      },

      async getApplicationConfig () {
        const current = await controller.capability.getConfig()
        // Remove all undefined keys from the config
        return JSON.parse(JSON.stringify(current))
      },

      async getApplicationEnv () {
        // Remove all undefined keys from the config
        return JSON.parse(JSON.stringify({ ...process.env, ...(await controller.capability.getEnv()) }))
      },

      async getApplicationOpenAPISchema () {
        try {
          return await controller.capability.getOpenapiSchema()
        } catch (err) {
          throw new FailedToRetrieveOpenAPISchemaError(application.id, err.message)
        }
      },

      async getApplicationGraphQLSchema () {
        try {
          return await controller.capability.getGraphqlSchema()
        } catch (err) {
          throw new FailedToRetrieveGraphQLSchemaError(application.id, err.message)
        }
      },

      async getApplicationMeta () {
        try {
          return await controller.capability.getMeta()
        } catch (err) {
          throw new FailedToRetrieveMetaError(application.id, err.message)
        }
      },

      async getMetrics (format) {
        try {
          return await controller.getMetrics({ format })
        } catch (err) {
          throw new FailedToRetrieveMetricsError(application.id, err.message)
        }
      },

      async getHealth () {
        try {
          return await controller.getHealth()
        } catch (err) {
          throw new FailedToRetrieveHealthError(application.id, err.message)
        }
      },

      async getCustomHealthCheck () {
        try {
          return await controller.capability.getCustomHealthCheck()
        } catch (err) {
          throw new FailedToPerformCustomHealthCheckError(application.id, err.message)
        }
      },

      async getCustomReadinessCheck () {
        try {
          return await controller.capability.getCustomReadinessCheck()
        } catch (err) {
          throw new FailedToPerformCustomReadinessCheckError(application.id, err.message)
        }
      },

      setSharedContext (context) {
        sharedContext._set(context)
      },

      saveMessagingChannel (channel) {
        messaging.addSource(channel)
      }
    }
  })

  controller.on('changed', () => {
    itc.notify('changed')
  })

  itc.listen()
  return itc
}
