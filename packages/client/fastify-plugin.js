'use strict'

const { buildOpenAPIClient, buildGraphQLClient } = require('./index.js')
const errors = require('./lib/errors.js')
const { kGetHeaders, kTelemetryContext } = require('./lib/symbols.js')

function capitalize (str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

async function plugin (app, opts) {
  let client = null
  let getHeaders = null

  if (typeof opts.getHeaders === 'function') {
    getHeaders = opts.getHeaders
    opts = { ...opts }
    opts.getHeaders = undefined
  }

  if (opts.applicationId && !opts.url) {
    opts.url = `http://${opts.applicationId}.plt.local`
  }

  if (opts.type === 'openapi') {
    client = await buildOpenAPIClient(opts, app.openTelemetry)
  } else if (opts.type === 'graphql') {
    if (!opts.url.endsWith('/graphql')) {
      opts.url += '/graphql'
    }
    client = await buildGraphQLClient(opts, app.openTelemetry, app.log)
  } else {
    throw new errors.WrongOptsTypeError()
  }

  let name = opts.name
  if (!name) {
    name = 'client'
  }

  app.decorateRequest(name, null)

  app.decorate('configure' + capitalize(name), function (opts) {
    getHeaders = opts.getHeaders
  })

  app.addHook('onRequest', async (req, reply) => {
    const newClient = Object.create(client)

    if (getHeaders) {
      newClient[kGetHeaders] = getHeaders.bind(newClient, req, reply)
    }
    if (req.span) {
      newClient[kTelemetryContext] = req.span.context
    }
    req[name] = newClient
  })
}

plugin[Symbol.for('skip-override')] = true
plugin[Symbol.for('plugin-meta')] = {
  name: '@platformatic/client'
}

module.exports = plugin
module.exports.default = plugin
