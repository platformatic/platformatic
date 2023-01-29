'use strict'

const { request } = require('undici')

async function buildOpenAPIClient (options) {
  const client = {}
  let spec
  if (options.url) {
    const res = await request(options.url)
    spec = await res.body.json()
  } else {
    throw new Error('options.url is required')
  }

  const baseUrl = spec.servers?.[0]?.url || computeURLWithoutPath(options.url)

  for (const path of Object.keys(spec.paths)) {
    const pathMeta = spec.paths[path]

    for (const method of Object.keys(pathMeta)) {
      const methodMeta = pathMeta[method]
      const operationId = methodMeta.operationId
      if (!operationId) {
        throw new Error(`operationId is required, missing for ${method} ${path}`)
      }

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
    const urlToCall = new URL(url)
    let pathToCall = path
    for (const param of pathParams) {
      pathToCall = pathToCall.replace(`{${param.name}}`, args[param.name]) 
    }

    urlToCall.pathname = pathToCall

    const res = await request(urlToCall, {
      method,
      headers: {
        'content-type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(args)
    })
    return await res.body.json()
  }
}

module.exports.buildOpenAPIClient = buildOpenAPIClient
