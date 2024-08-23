'use strict'

const { once } = require('node:events')
const { parentPort } = require('node:worker_threads')

const { ITC } = require('@platformatic/itc')

const errors = require('../errors')
const { kITC, kId } = require('./symbols')

async function sendViaITC (worker, name, message) {
  try {
    // Make sure to catch when the worker exits, otherwise we're stuck forever
    const ac = new AbortController()
    let exitCode

    const response = await Promise.race([
      worker[kITC].send(name, message),
      once(worker, 'exit', { signal: ac.signal }).then(([code]) => {
        exitCode = code
      })
    ])

    if (typeof exitCode === 'number') {
      throw new errors.ServiceExitedError(worker[kId], exitCode)
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

function setupITC (app, service, dispatcher) {
  const itc = new ITC({
    port: parentPort,
    handlers: {
      async start () {
        const status = app.getStatus()

        if (status === 'starting') {
          await once(app, 'start')
        } else {
          await app.start()
        }

        if (service.entrypoint) {
          await app.listen()
        }

        const url = app.stackable.getUrl()

        const dispatchFunc = await app.stackable.getDispatchFunc()
        dispatcher.replaceServer(url ?? dispatchFunc)

        return service.entrypoint ? url : null
      },

      async stop () {
        const status = app.getStatus()

        if (status === 'starting') {
          await once(app, 'start')
        }

        if (status !== 'stopped') {
          await app.stop()
        }

        dispatcher.interceptor.close()
        itc.close()
      },

      getStatus () {
        return app.getStatus()
      },

      getServiceInfo () {
        return app.stackable.getInfo()
      },

      async getServiceConfig () {
        const current = await app.stackable.getConfig()
        // Remove all undefined keys from the config
        return JSON.parse(JSON.stringify(current))
      },

      async getServiceOpenAPISchema () {
        try {
          return await app.stackable.getOpenapiSchema()
        } catch (err) {
          throw new errors.FailedToRetrieveOpenAPISchemaError(service.id, err.message)
        }
      },

      async getServiceGraphQLSchema () {
        try {
          return await app.stackable.getGraphqlSchema()
        } catch (err) {
          throw new errors.FailedToRetrieveGraphQLSchemaError(service.id, err.message)
        }
      },

      async getServiceMeta () {
        try {
          return await app.stackable.getMeta()
        } catch (err) {
          throw new errors.FailedToRetrieveMetaError(service.id, err.message)
        }
      },

      getMetrics (format) {
        return app.stackable.getMetrics({ format })
      },

      inject (injectParams) {
        return app.stackable.inject(injectParams)
      }
    }
  })

  app.on('changed', () => {
    itc.notify('changed')
  })

  return itc
}

module.exports = { sendViaITC, setupITC }
