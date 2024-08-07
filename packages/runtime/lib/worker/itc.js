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
      }),
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
  const itc = new ITC({ port: parentPort })

  itc.handle('start', async () => {
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

    dispatcher.replaceServer(url ?? app.stackable)

    return service.entrypoint ? url : null
  })

  itc.handle('stop', async () => {
    const status = app.getStatus()

    if (status === 'starting') {
      await once(app, 'start')
    }

    if (status !== 'stopped') {
      await app.stop()
    }

    dispatcher.interceptor.close()
    itc.close()
  })

  itc.handle('getStatus', async () => {
    return app.getStatus()
  })

  itc.handle('getServiceInfo', async () => {
    return app.stackable.getInfo()
  })

  itc.handle('getServiceConfig', async () => {
    const current = await app.stackable.getConfig()
    // Remove all undefined keys from the config
    return JSON.parse(JSON.stringify(current))
  })

  itc.handle('getServiceOpenAPISchema', async () => {
    try {
      return app.stackable.getOpenapiSchema()
    } catch (err) {
      throw new errors.FailedToRetrieveOpenAPISchemaError(service.id, err.message)
    }
  })

  itc.handle('getServiceGraphQLSchema', async () => {
    try {
      return app.stackable.getGraphqlSchema()
    } catch (err) {
      throw new errors.FailedToRetrieveGraphQLSchemaError(service.id, err.message)
    }
  })

  itc.handle('getMetrics', async format => {
    return app.stackable.getMetrics({ format })
  })

  itc.handle('inject', async injectParams => {
    return app.stackable.inject(injectParams)
  })

  app.on('changed', () => {
    itc.notify('changed')
  })

  return itc
}

module.exports = { sendViaITC, setupITC }
