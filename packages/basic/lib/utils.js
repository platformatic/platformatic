'use strict'

import { tracingChannel } from 'node:diagnostics_channel'
import { request } from 'undici'

export function getServerUrl (server) {
  const { family, address, port } = server.address()

  return new URL(family === 'IPv6' ? `http://[${address}]:${port}` : `http://${address}:${port}`).origin
}

// Paolo: This is kinda hackish but there is no better way. I apologize.
export function isFastify (app) {
  return Object.getOwnPropertySymbols(app).some(s => s.description === 'fastify.state')
}

export function createPortManager () {
  let resolve
  let reject

  const promise = new Promise((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  })

  const subscribers = {
    asyncStart ({ options }) {
      options.port = 0
    },
    asyncEnd: ({ server }) => {
      resolve(server)
    },
    error: reject,
  }

  tracingChannel('net.server.listen').subscribe(subscribers)

  return {
    getServer () {
      return promise
    },
    destroy () {
      tracingChannel('net.server.listen').unsubscribe(subscribers)
    },
  }
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
