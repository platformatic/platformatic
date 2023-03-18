'use strict'

const { request } = require('undici')
const fs = require('fs/promises')
const kHeaders = Symbol('headers')
const abstractLogging = require('abstract-logging')

function generateOperationId (path, method, methodMeta) {
  let operationId = methodMeta.operationId
  if (!operationId) {
    const pathParams = methodMeta.parameters?.filter(p => p.in === 'path') || []
    let stringToUpdate = path
    for (const param of pathParams) {
      stringToUpdate = stringToUpdate.replace(`{${param.name}}`, capitalize(param.name))
    }
    operationId = method.toLowerCase() + stringToUpdate.split('/').map(capitalize).join('')
  }
  return operationId
}

async function buildOpenAPIClient (options) {
  const client = {}
  let spec

  // this is tested, not sure why c8 is not picking it up
  /* c8 ignore next 3 */
  if (options.file) {
    spec = JSON.parse(await fs.readFile(options.file, 'utf8'))
  } else if (options.url) {
    const res = await request(options.url)
    spec = await res.body.json()
  } else {
    throw new Error('options.url or options.file are required')
  }

  const baseUrl = computeURLWithoutPath(options.url)
  client[kHeaders] = options.headers || {}

  for (const path of Object.keys(spec.paths)) {
    const pathMeta = spec.paths[path]

    for (const method of Object.keys(pathMeta)) {
      const methodMeta = pathMeta[method]
      const operationId = generateOperationId(path, method, methodMeta)

      client[operationId] = buildCallFunction(baseUrl, path, method, methodMeta, operationId)
    }
  }

  return client
}

function computeURLWithoutPath (url) {
  url = new URL(url)
  url.pathname = ''
  return url.toString()
}

function buildCallFunction (baseUrl, path, method, methodMeta, operationId) {
  const url = new URL(baseUrl)
  method = method.toUpperCase()

  const pathParams = methodMeta.parameters?.filter(p => p.in === 'path') || []
  const queryParams = methodMeta.parameters?.filter(p => p.in === 'query') || []

  return async function (args) {
    const headers = this[kHeaders]
    const body = { ...args } // shallow copy
    const urlToCall = new URL(url)
    const query = new URLSearchParams()
    let pathToCall = path
    for (const param of pathParams) {
      if (body[param.name] === undefined) {
        throw new Error('missing required parameter ' + param.name)
      }
      pathToCall = pathToCall.replace(`{${param.name}}`, body[param.name])
      body[param.name] = undefined
    }

    for (const param of queryParams) {
      if (body[param.name] !== undefined) {
        query.set(param.name, body[param.name])
        body[param.name] = undefined
      }
    }

    urlToCall.search = query.toString()
    urlToCall.pathname = pathToCall

    const res = await request(urlToCall, {
      method,
      headers: {
        ...headers,
        'content-type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(args)
    })
    return await res.body.json()
  }
}

function capitalize (str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// TODO: For some unknown reason c8 is not picking up the coverage for this function
async function graphql (url, log, headers, query, variables) {
  const res = await request(url, {
    method: 'POST',
    headers: {
      ...headers,
      'content-type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({
      query,
      variables
    })
  })
  const json = await res.body.json()

  if (res.statusCode !== 200) {
    log.warn({ statusCode: res.statusCode, json }, 'request to client failed')
    throw new Error('request to client failed')
  }

  if (json.errors) {
    log.warn({ errors: json.errors }, 'errors in graphql response')
    const e = new Error(json.errors.map(e => e.message).join(''))
    e.errors = json.errors
    throw e
  }

  const keys = Object.keys(json.data)
  if (keys.length !== 1) {
    return json.data
  } else {
    return json.data[keys[0]]
  }
}

function wrapGraphQLClient (url, logger) {
  return function ({ query, variables }) {
    const headers = this[kHeaders]
    const log = this.log || logger

    return graphql(url, log, headers, query, variables)
  }
}

async function buildGraphQLClient (options, logger = abstractLogging) {
  options = options || {}
  if (!options.url) {
    throw new Error('options.url is required')
  }

  return {
    graphql: wrapGraphQLClient(options.url, logger),
    [kHeaders]: options.headers || {}
  }
}

async function plugin (app, opts) {
  let client = null
  let getHeaders = null

  /* c8 ignore next 5 */
  if (typeof opts.getHeaders === 'function') {
    getHeaders = opts.getHeaders
    opts = { ...opts }
    opts.getHeaders = undefined
  }

  if (opts.type === 'openapi') {
    client = await buildOpenAPIClient(opts)
  } else if (opts.type === 'graphql') {
    client = await buildGraphQLClient(opts, app.log)
  } else {
    throw new Error('opts.type must be either "openapi" or "graphql" ff')
  }

  let name = opts.name
  if (!name) {
    name = 'client'
  }

  app.decorate(name, client)
  app.decorateRequest(name, null)

  app.addHook('onRequest', async (req, reply) => {
    const newClient = Object.create(client)
    newClient[kHeaders] = getHeaders ? await getHeaders(req, reply) : {}
    req[name] = newClient
  })
}

plugin[Symbol.for('skip-override')] = true
plugin[Symbol.for('plugin-meta')] = {
  name: '@platformatic/client'
}

module.exports = plugin
module.exports.buildOpenAPIClient = buildOpenAPIClient
module.exports.buildGraphQLClient = buildGraphQLClient
module.exports.generateOperationId = generateOperationId
