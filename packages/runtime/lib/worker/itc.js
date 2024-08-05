'use strict'

const { once } = require('node:events')
const { parentPort } = require('node:worker_threads')

const { printSchema } = require('graphql')
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

    dispatcher.replaceServer(app.appConfig.useHttp ? app.server.url : app.server)

    return service.entrypoint ? app.server.url : null
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
    const type = app.config?.configType
    const version = app.config?.app?.configManagerConfig.version ?? null

    return { type, version }
  })

  itc.handle('getServiceConfig', async () => {
    const current = app.config.configManager.current
    const { logger: _logger, ...server } = current.server

    // Remove all undefined keys from the config
    return JSON.parse(JSON.stringify({ ...current, server: { ...server, logger: undefined } }))
  })

  itc.handle('getServiceOpenAPISchema', async () => {
    if (typeof app.server.swagger !== 'function') {
      return null
    }

    try {
      await app.server.ready()
      return app.server.swagger()
    } catch (err) {
      throw new errors.FailedToRetrieveOpenAPISchemaError(service.id, err.message)
    }
  })

  itc.handle('getServiceGraphQLSchema', async () => {
    if (typeof app.server.graphql !== 'function') {
      return null
    }

    try {
      await app.server.ready()
      return printSchema(app.server.graphql.schema)
    } catch (err) {
      throw new errors.FailedToRetrieveGraphQLSchemaError(service.id, err.message)
    }
  })

  itc.handle('getMetrics', async format => {
    const promRegister = app.server.metrics?.client?.register

    if (!promRegister) {
      return null
    }

    return format === 'json' ? promRegister.getMetricsAsJSON() : promRegister.metrics()
  })

  itc.handle('inject', async injectParams => {
    const { statusCode, statusMessage, headers, body } = await app.server.inject(injectParams)

    return { statusCode, statusMessage, headers, body }
  })

  app.on('changed', () => {
    itc.notify('changed')
  })

  return itc
}

module.exports = { sendViaITC, setupITC }
