import { ensureLoggableError } from '@platformatic/foundation'
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

export async function waitEventFromITC (worker, event) {
  return safeHandleInITC(worker, () => once(worker[kITC], event))
}

export function setupITC (instance, application, dispatcher, sharedContext) {
  const messaging = new MessagingITC(instance.appConfig.id, workerData.config)

  Object.assign(globalThis.platformatic ?? {}, {
    messaging: {
      handle: messaging.handle.bind(messaging),
      send: messaging.send.bind(messaging)
    }
  })

  const itc = new ITC({
    name: instance.appConfig.id + '-worker',
    port: parentPort,
    handlers: {
      async start () {
        const status = instance.getStatus()

        if (status === 'starting') {
          await once(instance, 'start')
        } else {
          // This gives a chance to a capability to perform custom logic
          globalThis.platformatic.events.emit('start')

          try {
            await instance.start()
          } catch (e) {
            await instance.stop(true)
            await closeITC(dispatcher, itc, messaging)

            throw ensureLoggableError(e)
          }
        }

        if (application.entrypoint) {
          await instance.listen()
        }

        dispatcher.replaceServer(await instance.capability.getDispatchTarget())
        return application.entrypoint ? instance.capability.getUrl() : null
      },

      async stop () {
        const status = instance.getStatus()

        if (status === 'starting') {
          await once(instance, 'start')
        }

        if (status.startsWith('start')) {
          // This gives a chance to a capability to perform custom logic
          globalThis.platformatic.events.emit('stop')

          await instance.stop()
        }

        await closeITC(dispatcher, itc, messaging)
      },

      async build () {
        return instance.capability.build()
      },

      async removeFromMesh () {
        return dispatcher.interceptor.close()
      },

      inject (injectParams) {
        return instance.capability.inject(injectParams)
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
        return instance.getStatus()
      },

      getApplicationInfo () {
        return instance.capability.getInfo()
      },

      async getApplicationConfig () {
        const current = await instance.capability.getConfig()
        // Remove all undefined keys from the config
        return JSON.parse(JSON.stringify(current))
      },

      async getApplicationEnv () {
        // Remove all undefined keys from the config
        return JSON.parse(JSON.stringify({ ...process.env, ...(await instance.capability.getEnv()) }))
      },

      async getApplicationOpenAPISchema () {
        try {
          return await instance.capability.getOpenapiSchema()
        } catch (err) {
          throw new FailedToRetrieveOpenAPISchemaError(application.id, err.message)
        }
      },

      async getApplicationGraphQLSchema () {
        try {
          return await instance.capability.getGraphqlSchema()
        } catch (err) {
          throw new FailedToRetrieveGraphQLSchemaError(application.id, err.message)
        }
      },

      async getApplicationMeta () {
        try {
          return await instance.capability.getMeta()
        } catch (err) {
          throw new FailedToRetrieveMetaError(application.id, err.message)
        }
      },

      async getMetrics (format) {
        try {
          return await instance.getMetrics({ format })
        } catch (err) {
          throw new FailedToRetrieveMetricsError(application.id, err.message)
        }
      },

      async getHealth () {
        try {
          return await instance.getHealth()
        } catch (err) {
          throw new FailedToRetrieveHealthError(application.id, err.message)
        }
      },

      async getCustomHealthCheck () {
        try {
          return await instance.capability.getCustomHealthCheck()
        } catch (err) {
          throw new FailedToPerformCustomHealthCheckError(application.id, err.message)
        }
      },

      async getCustomReadinessCheck () {
        try {
          return await instance.capability.getCustomReadinessCheck()
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

  instance.on('changed', () => {
    itc.notify('changed')
  })

  itc.listen()
  return itc
}
