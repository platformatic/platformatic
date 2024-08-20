import { pathToFileURL } from 'node:url'
import { request } from 'undici'

export function getServerUrl (server) {
  const { family, address, port } = server.address()

  return new URL(family === 'IPv6' ? `http://[${address}]:${port}` : `http://${address}:${port}`).origin
}

export async function injectViaRequest (baseUrl, injectParams, onInject) {
  const url = new URL(injectParams.url, baseUrl).href
  const requestParams = { method: injectParams.method, headers: injectParams.headers }

  if (injectParams.body) {
    const body = injectParams.body
    requestParams.body = typeof body === 'object' ? JSON.stringify(body) : body
  }

  try {
    const { statusCode, headers, body } = await request(url, requestParams)

    const rawPayload = Buffer.from(await body.arrayBuffer())
    const payload = rawPayload.toString()
    const response = { statusCode, headers, body: payload, payload, rawPayload }

    if (onInject) {
      return onInject(null, response)
    }

    return response
  } catch (error) {
    if (onInject) {
      onInject(error)
      return
    }

    throw error
  }
}

// This is to avoid common path/URL problems on Windows
export function importFile (path) {
  return import(pathToFileURL(path))
}
