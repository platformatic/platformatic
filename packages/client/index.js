'use strict'

const { request } = require('undici')
const { join } = require('path')
const fs = require('fs/promises')
const kHeaders = Symbol('headers')
const kGetHeaders = Symbol('getHeaders')
const kTelemetryContext = Symbol('telemetry-context')
const abstractLogging = require('abstract-logging')
const Ajv = require('ajv')
const $RefParser = require('@apidevtools/json-schema-ref-parser')
const { createHash } = require('node:crypto')
const validateFunctionCache = {}
const errors = require('./errors')
const camelCase = require('camelcase')

function generateOperationId (path, method, methodMeta, all) {
  let operationId = null
  // use methodMeta.operationId only if it's present AND it is a valid string that can be
  // concatenated without converting it
  // i.e
  // operationId = "MyOperationId123" is valid
  // operationId = "/v3/accounts/{id}" is NOT valid and sholuld be converted in "V3AccountsId"
  if (methodMeta.operationId && methodMeta.operationId.match(/^[a-zA-z0-9]+$/)) {
    operationId = methodMeta.operationId
  }
  if (!operationId) {
    const pathParams = methodMeta.parameters?.filter(p => p.in === 'path') || []
    let stringToUpdate = path
    for (const param of pathParams) {
      stringToUpdate = stringToUpdate.replace(`{${param.name}}`, capitalize(param.name))
    }
    operationId =
      method.toLowerCase() +
      stringToUpdate
        .split(/[/-]+/)
        .map((token) => {
          const sanitized = token.replace(/[^a-zA-z0-9]/g, '')
          return capitalize(sanitized)
        }).join('')
  } else {
    let count = 0
    let candidate = operationId
    while (all.includes(candidate)) {
      if (count === 0) {
        // first try with method name
        candidate = `${method}${capitalize(operationId)}`
      } else {
        candidate = `${method}${capitalize(operationId)}${count}`
      }
      count++
    }
    operationId = candidate
  }
  operationId = camelCase(operationId)
  all.push(operationId)
  return operationId
}

async function buildOpenAPIClient (options, openTelemetry) {
  const client = {}
  let spec
  let baseUrl

  if (typeof options.getHeaders === 'function') {
    const getHeaders = options.getHeaders
    options = { ...options }
    client[kGetHeaders] = getHeaders
    options.getHeaders = undefined
  }

  const { validateResponse, queryParser } = options
  // this is tested, not sure why c8 is not picking it up
  if (!options.url) {
    throw new errors.OptionsUrlRequiredError()
  }
  if (options.path) {
    spec = JSON.parse(await fs.readFile(options.path, 'utf8'))
    baseUrl = options.url.replace(/\/$/, '')
  } else {
    const res = await request(options.url)
    spec = await res.body.json()
    baseUrl = computeURLWithoutPath(options.url)
  }

  const kOperationIdMap = Symbol.for('plt.operationIdMap')
  client[kOperationIdMap] = {}
  client[kHeaders] = options.headers || {}

  let { fullRequest, fullResponse, throwOnError } = options
  const generatedOperationIds = []
  for (const path of Object.keys(spec.paths)) {
    const pathMeta = spec.paths[path]
    let commonParameters = []
    if (pathMeta.parameters) {
      commonParameters = pathMeta.parameters
      delete pathMeta.parameters
    }
    for (const method of Object.keys(pathMeta)) {
      const methodMeta = pathMeta[method]
      if (methodMeta.parameters) {
        methodMeta.parameters = [...methodMeta.parameters, ...commonParameters]
      } else {
        methodMeta.parameters = commonParameters
      }
      const operationId = generateOperationId(path, method, methodMeta, generatedOperationIds)
      const responses = pathMeta[method].responses
      const successResponses = Object.entries(responses).filter(([s]) => s.startsWith('2'))
      if (successResponses.length !== 1) {
        // force fullResponse = true if
        // - there is more than 1 responses with 2XX code
        // - there is no responses with 2XX code
        fullResponse = true
      }

      client[kOperationIdMap][operationId] = { path, method }
      client[operationId] = await buildCallFunction(spec, baseUrl, path, method, methodMeta, throwOnError, openTelemetry, fullRequest, fullResponse, validateResponse, queryParser)
    }
  }
  return client
}

function computeURLWithoutPath (url) {
  url = new URL(url)
  url.pathname = ''
  return url.toString()
}
function hasDuplicatedParameters (methodMeta) {
  if (!methodMeta.parameters) return false
  if (methodMeta.parameters.length === 0) {
    return false
  }
  const s = new Set()
  methodMeta.parameters.forEach((param) => {
    s.add(param.name)
  })
  return s.size !== methodMeta.parameters.length
}

async function buildCallFunction (spec, baseUrl, path, method, methodMeta, throwOnError, openTelemetry, fullRequest, fullResponse, validateResponse, queryParser) {
  await $RefParser.dereference(spec)
  const ajv = new Ajv()
  const url = new URL(baseUrl)
  method = method.toUpperCase()
  path = join(url.pathname, path)

  const canHaveBody = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'OPTIONS'
  const pathParams = methodMeta.parameters?.filter(p => p.in === 'path') || []
  const queryParams = methodMeta.parameters?.filter(p => p.in === 'query') || []
  const headerParams = methodMeta.parameters?.filter(p => p.in === 'header') || []
  const forceFullRequest = fullRequest || hasDuplicatedParameters(methodMeta)

  const responses = methodMeta.responses
  return async function (args) {
    let headers = this[kHeaders]
    let telemetryContext = null
    if (this[kTelemetryContext]) {
      telemetryContext = this[kTelemetryContext]
    }
    let body
    const query = new URLSearchParams()
    let pathToCall = path
    const urlToCall = new URL(url)
    if (forceFullRequest) {
      headers = args?.headers
      body = args?.body || ''
      for (const param of pathParams) {
        if (args?.path[param.name] === undefined) {
          throw new Error('missing required parameter ' + param.name)
        }
        pathToCall = pathToCall.replace(`{${param.name}}`, args.path[param.name])
        args.path[param.name] = undefined
      }

      for (const param of queryParams) {
        if (args?.query?.[param.name] !== undefined) {
          if (isArrayQueryParam(param)) {
            args.query[param.name].forEach((p) => query.append(param.name, p))
          } else {
            query.append(param.name, args.query[param.name])
          }
          args.query[param.name] = undefined
        }
      }
    } else {
      body = { ...args } || '' // shallow copy
      for (const param of pathParams) {
        if (body[param.name] === undefined) {
          throw new Error('missing required parameter ' + param.name)
        }
        pathToCall = pathToCall.replace(`{${param.name}}`, body[param.name])
        body[param.name] = undefined
      }

      for (const param of queryParams) {
        if (body[param.name] !== undefined) {
          if (isArrayQueryParam(param)) {
            body[param.name].forEach((p) => query.append(param.name, p))
          } else {
            query.append(param.name, body[param.name])
          }
          body[param.name] = undefined
        }
      }

      for (const param of headerParams) {
        if (body[param.name] !== undefined) {
          headers[param.name] = body[param.name]
          body[param.name] = undefined
        }
      }
    }

    urlToCall.search = queryParser ? queryParser(query) : query.toString()
    urlToCall.pathname = pathToCall

    const { span, telemetryHeaders } = openTelemetry?.startSpanClient(urlToCall.toString(), method, telemetryContext) || { span: null, telemetryHeaders: {} }

    if (this[kGetHeaders]) {
      const options = { url: urlToCall, method, headers, telemetryHeaders, body }
      headers = { ...headers, ...(await this[kGetHeaders](options)) }
    }

    let res
    try {
      const requestOptions = {
        method,
        headers: {
          ...headers,
          ...telemetryHeaders
        },
        throwOnError
      }
      if (canHaveBody) {
        requestOptions.headers['content-type'] = 'application/json; charset=utf-8'
        requestOptions.body = JSON.stringify(body)
      }
      res = await request(urlToCall, requestOptions)
      let responseBody
      const contentType = sanitizeContentType(res.headers['content-type']) || 'application/json'
      try {
        if (res.statusCode === 204) {
          await res.body.dump()
        } else if (contentType === 'application/json') {
          responseBody = await res.body.json()
        } else {
          responseBody = await res.body.text()
        }
      } catch (err) {
        // maybe the response is a 302, 301, or anything with empty payload
        responseBody = {}
      }
      if (validateResponse) {
        try {
          // validate response first
          const matchingResponse = responses[res.statusCode]

          if (matchingResponse === undefined) {
            throw new Error(`No matching response schema found for status code ${res.statusCode}`)
          }
          const matchingContentSchema = matchingResponse.content[contentType]

          if (matchingContentSchema === undefined) {
            throw new Error(`No matching content type schema found for ${contentType}`)
          }
          const bodyIsValid = checkResponseAgainstSchema(responseBody, matchingContentSchema.schema, ajv)

          if (!bodyIsValid) {
            throw new Error('Invalid response format')
          }
        } catch (err) {
          responseBody = createErrorResponse(err.message)
        }
      }
      if (fullResponse) {
        return {
          statusCode: res.statusCode,
          headers: res.headers,
          body: responseBody
        }
      }
      return responseBody
    } catch (err) {
      openTelemetry?.setErrorInSpanClient(span, err)
      throw err
    } finally {
      openTelemetry?.endSpanClient(span, res)
    }
  }
}
function createErrorResponse (message) {
  return {
    statusCode: 500,
    message
  }
}
function sanitizeContentType (contentType) {
  if (!contentType) { return false }
  const split = contentType.split(';')
  return split[0]
}
function checkResponseAgainstSchema (body, schema, ajv) {
  const validate = getValidateFunction(schema, ajv)
  const valid = validate(body)
  return valid
}

function getValidateFunction (schema, ajvInstance) {
  const hash = createHash('md5').update(JSON.stringify(schema)).digest('hex')
  if (!validateFunctionCache[hash]) {
    validateFunctionCache[hash] = ajvInstance.compile(schema)
  }
  return validateFunctionCache[hash]
}
function capitalize (str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function isArrayQueryParam ({ schema }) {
  return schema?.type === 'array' || schema?.anyOf?.some(({ type }) => type === 'array')
}

// TODO: For some unknown reason c8 is not picking up the coverage for this function
async function graphql (url, log, headers, query, variables, openTelemetry, telemetryContext) {
  const { span, telemetryHeaders } = openTelemetry?.startSpanClient(url.toString(), 'POST', telemetryContext) || { span: null, telemetryHeaders: {} }
  let res
  try {
    res = await request(url, {
      method: 'POST',
      headers: {
        ...headers,
        ...telemetryHeaders,
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
  } catch (err) {
    openTelemetry?.setErrorInSpanClient(span, err)
    throw err
  } finally {
    openTelemetry?.endSpanClient(span, res)
  }
}

function wrapGraphQLClient (url, openTelemetry, logger) {
  return async function ({ query, variables }) {
    let headers = this[kHeaders]
    const telemetryContext = this[kTelemetryContext]
    if (typeof this[kGetHeaders] === 'function') {
      headers = { ...headers, ...(await this[kGetHeaders]()) }
    }
    const log = this.log || logger

    return graphql(url, log, headers, query, variables, openTelemetry, telemetryContext)
  }
}

async function buildGraphQLClient (options, openTelemetry, logger = abstractLogging) {
  options = options || {}
  if (!options.url) {
    throw new Error('options.url is required')
  }

  return {
    graphql: wrapGraphQLClient(options.url, openTelemetry, logger),
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
    client = await buildOpenAPIClient(opts, app.openTelemetry)
  } else if (opts.type === 'graphql') {
    if (!opts.url.endsWith('/graphql')) {
      opts.url += '/graphql'
    }
    client = await buildGraphQLClient(opts, app.openTelemetry, app.log)
  } else {
    throw new Error('opts.type must be either "openapi" or "graphql"')
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
module.exports.buildOpenAPIClient = buildOpenAPIClient
module.exports.buildGraphQLClient = buildGraphQLClient
module.exports.generateOperationId = generateOperationId
module.exports.hasDuplicatedParameters = hasDuplicatedParameters
module.exports.errors = errors
