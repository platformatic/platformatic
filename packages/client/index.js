'use strict'

const { request } = require('undici')
const { join } = require('path')
const fs = require('fs/promises')
const kHeaders = Symbol('headers')
const kGetHeaders = Symbol('getHeaders')
const abstractLogging = require('abstract-logging')

function generateOperationId (path, method, methodMeta) {
  let operationId = methodMeta.operationId
  if (!operationId) {
    const pathParams = methodMeta.parameters?.filter(p => p.in === 'path') || []
    let stringToUpdate = path
    for (const param of pathParams) {
      stringToUpdate = stringToUpdate.replace(`{${param.name}}`, capitalize(param.name))
    }
    operationId = method.toLowerCase() + stringToUpdate.split(/[/-]+/).map(capitalize).join('')
  }
  return operationId
}

async function buildOpenAPIClient (options) {
  const client = {}
  let spec
  let baseUrl

  // this is tested, not sure why c8 is not picking it up
  if (options.path) {
    spec = JSON.parse(await fs.readFile(options.path, 'utf8'))
    baseUrl = options.url.replace(/\/$/, '')
  } else if (options.url) {
    const res = await request(options.url)
    spec = await res.body.json()
    baseUrl = computeURLWithoutPath(options.url)
  } else {
    throw new Error('options.url or options.file are required')
  }

  client[kHeaders] = options.headers || {}
  const { fullResponse, throwOnError } = options

  for (const path of Object.keys(spec.paths)) {
    const pathMeta = spec.paths[path]

    for (const method of Object.keys(pathMeta)) {
      const methodMeta = pathMeta[method]
      const operationId = generateOperationId(path, method, methodMeta)

      client[operationId] = buildCallFunction(baseUrl, path, method, methodMeta, fullResponse, throwOnError)
    }
  }

  return client
}

function computeURLWithoutPath (url) {
  url = new URL(url)
  url.pathname = ''
  return url.toString()
}

function buildCallFunction (baseUrl, path, method, methodMeta, fullResponse, throwOnError) {
  const url = new URL(baseUrl)
  method = method.toUpperCase()
  path = join(url.pathname, path)

  const pathParams = methodMeta.parameters?.filter(p => p.in === 'path') || []
  const queryParams = methodMeta.parameters?.filter(p => p.in === 'query') || []
  const headerParams = methodMeta.parameters?.filter(p => p.in === 'header') || []

  return async function (args) {
    let headers = this[kHeaders]
    if (this[kGetHeaders]) {
      headers = { ...headers, ...(await this[kGetHeaders]()) }
    }
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

    for (const param of headerParams) {
      if (body[param.name] !== undefined) {
        headers[param.name] = body[param.name]
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
      body: JSON.stringify(body),
      throwOnError
    })

    const responseBody = res.statusCode === 204
      ? await res.body.dump()
      : await res.body.json()

    if (fullResponse) {
      return {
        statusCode: res.statusCode,
        headers: res.headers,
        body: responseBody
      }
    }

    return responseBody
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
  return async function ({ query, variables }) {
    let headers = this[kHeaders]
    if (typeof this[kGetHeaders] === 'function') {
      headers = { ...headers, ...(await this[kGetHeaders]()) }
    }
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

  if (typeof opts.getHeaders === 'function') {
    getHeaders = opts.getHeaders
    opts = { ...opts }
    opts.getHeaders = undefined
  }

  if (opts.serviceId && !opts.url) {
    opts.url = `http://${opts.serviceId}.plt.local`
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

  app.decorate('configure' + capitalize(name), function (opts) {
    getHeaders = opts.getHeaders
  })

  app.addHook('onRequest', async (req, reply) => {
    const newClient = Object.create(client)
    if (getHeaders) {
      newClient[kGetHeaders] = getHeaders.bind(newClient, req, reply)
    }
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
