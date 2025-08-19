'use strict'

const { once } = require('node:events')
const { parentPort, workerData } = require('node:worker_threads')

const { ITC } = require('@platformatic/itc')
const { ensureLoggableError } = require('@platformatic/foundation')
const { Unpromise } = require('@watchable/unpromise')

const errors = require('../errors')
const { updateUndiciInterceptors } = require('./interceptors')
const { kITC, kId, kServiceId, kWorkerId } = require('./symbols')
const { MessagingITC } = require('./messaging')

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
        throw new errors.WorkerExitedError(worker[kWorkerId], worker[kServiceId], exitCode)
      } else {
        throw new errors.ServiceExitedError(worker[kId], exitCode)
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

async function sendViaITC (worker, name, message, transferList) {
  return safeHandleInITC(worker, () => worker[kITC].send(name, message, { transferList }))
}

async function waitEventFromITC (worker, event) {
  return safeHandleInITC(worker, () => once(worker[kITC], event))
}

async function closeITC (dispatcher, itc, messaging) {
  await dispatcher.interceptor.close()
  itc.close()
  messaging.close()
}

function setupITC (app, service, dispatcher, sharedContext) {
  const messaging = new MessagingITC(app.appConfig.id, workerData.config)

  Object.assign(globalThis.platformatic ?? {}, {
    messaging: {
      handle: messaging.handle.bind(messaging),
      send: messaging.send.bind(messaging)
    }
  })

  const itc = new ITC({
    name: app.appConfig.id + '-worker',
    port: parentPort,
    handlers: {
      async start () {
        const status = app.getStatus()

        if (status === 'starting') {
          await once(app, 'start')
        } else {
          // This gives a chance to a capability to perform custom logic
          globalThis.platformatic.events.emit('start')

          try {
            await app.start()
          } catch (e) {
            await app.stop(true)
            await closeITC(dispatcher, itc, messaging)

            throw ensureLoggableError(e)
          }
        }

        if (service.entrypoint) {
          await app.listen()
        }

        dispatcher.replaceServer(await app.capability.getDispatchTarget())
        return service.entrypoint ? app.capability.getUrl() : null
      },

      async stop () {
        const status = app.getStatus()

        if (status === 'starting') {
          await once(app, 'start')
        }

        if (status.startsWith('start')) {
          // This gives a chance to a capability to perform custom logic
          globalThis.platformatic.events.emit('stop')

          await app.stop()
        }

        await closeITC(dispatcher, itc, messaging)
      },

      async build () {
        return app.capability.build()
      },

      async removeFromMesh () {
        return dispatcher.interceptor.close()
      },

      inject (injectParams) {
        return app.capability.inject(injectParams)
      },

      async updateUndiciInterceptors (undiciConfig) {
        await updateUndiciInterceptors(undiciConfig)
      },

      async updateWorkersCount (data) {
        const { serviceId, workers } = data
        const worker = workerData.config.serviceMap.get(serviceId)
        if (worker) {
          worker.workers = workers
        }
        workerData.serviceConfig.workers = workers
        workerData.worker.count = workers
      },

      getStatus () {
        return app.getStatus()
      },

      getServiceInfo () {
        return app.capability.getInfo()
      },

      async getServiceConfig () {
        const current = await app.capability.getConfig()
        // Remove all undefined keys from the config
        return JSON.parse(JSON.stringify(current))
      },

      async getServiceEnv () {
        // Remove all undefined keys from the config
        return JSON.parse(JSON.stringify({ ...process.env, ...(await app.capability.getEnv()) }))
      },

      async getServiceOpenAPISchema () {
        try {
          return await app.capability.getOpenapiSchema()
        } catch (err) {
          throw new errors.FailedToRetrieveOpenAPISchemaError(service.id, err.message)
        }
      },

      async getServiceGraphQLSchema () {
        try {
          return await app.capability.getGraphqlSchema()
        } catch (err) {
          throw new errors.FailedToRetrieveGraphQLSchemaError(service.id, err.message)
        }
      },

      async getServiceMeta () {
        try {
          return await app.capability.getMeta()
        } catch (err) {
          throw new errors.FailedToRetrieveMetaError(service.id, err.message)
        }
      },

      async getMetrics (format) {
        try {
          return await app.getMetrics({ format })
        } catch (err) {
          throw new errors.FailedToRetrieveMetricsError(service.id, err.message)
        }
      },

      async getHealth () {
        try {
          return await app.getHealth()
        } catch (err) {
          throw new errors.FailedToRetrieveHealthError(service.id, err.message)
        }
      },

      async getCustomHealthCheck () {
        try {
          return await app.capability.getCustomHealthCheck()
        } catch (err) {
          throw new errors.FailedToPerformCustomHealthCheckError(service.id, err.message)
        }
      },

      async getCustomReadinessCheck () {
        try {
          return await app.capability.getCustomReadinessCheck()
        } catch (err) {
          throw new errors.FailedToPerformCustomReadinessCheckError(service.id, err.message)
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

  app.on('changed', () => {
    itc.notify('changed')
  })

  itc.listen()
  return itc
}

module.exports = { sendViaITC, setupITC, waitEventFromITC }
