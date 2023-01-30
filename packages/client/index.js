'use strict'

const { request } = require('undici')
const fs = require('fs/promises')

async function buildOpenAPIClient (options) {
  const client = {}
  let spec

  if (options.file) {
    spec = JSON.parse(await fs.readFile(options.file, 'utf8'))
  } else if (options.url) {
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
      let operationId = methodMeta.operationId
      if (!operationId) {
        const pathParams = methodMeta.parameters?.filter(p => p.in === 'path') || []
        let stringToUpdate = path
        for (const param of pathParams) {
          stringToUpdate = stringToUpdate.replace(`{${param.name}}`, capitalize(param.name))
        }
        operationId = method.toLowerCase() + stringToUpdate.split('/').map(capitalize).join('')
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

module.exports.buildOpenAPIClient = buildOpenAPIClient
