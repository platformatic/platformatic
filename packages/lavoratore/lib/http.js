import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const bodylessMethods = new Set(['GET', 'HEAD'])

// Converts a Node.js IncomingMessage (or a light-my-request one) to a Fetch API Request
export function toRequest (req, res) {
  const protocol = req.socket?.encrypted ? 'https' : 'http'
  const url = new URL(req.url, `${protocol}://${req.headers.host ?? 'localhost'}`)
  const headers = new Headers()

  for (const [name, value] of Object.entries(req.headers)) {
    // Skip HTTP/2 pseudo-headers
    if (name.startsWith(':') || value === undefined) {
      continue
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item)
      }
    } else {
      headers.set(name, value)
    }
  }

  // Abort the request if the client goes away before the response is completed
  const controller = new AbortController()
  res.once('close', () => {
    if (!res.writableFinished) {
      controller.abort()
    }
  })

  const init = { method: req.method, headers, signal: controller.signal }

  if (!bodylessMethods.has(req.method)) {
    init.body = Readable.toWeb(req)
    init.duplex = 'half'
  }

  return new Request(url, init)
}

// Writes a Fetch API Response to a Node.js ServerResponse
export async function writeResponse (res, response) {
  const headers = {}

  for (const [name, value] of response.headers) {
    if (name !== 'set-cookie') {
      headers[name] = value
    }
  }

  const cookies = response.headers.getSetCookie?.() ?? []
  if (cookies.length) {
    headers['set-cookie'] = cookies
  }

  res.writeHead(response.status, response.statusText, headers)

  if (!response.body) {
    res.end()
    return
  }

  await pipeline(Readable.from(response.body), res)
}

// Clones a Fetch API Request (which can come from a different undici instance) into fetch() arguments
export function toFetchInit (request) {
  const init = { method: request.method, headers: Array.from(request.headers), redirect: 'manual' }

  if (request.body) {
    init.body = request.body
    init.duplex = 'half'
  }

  return init
}

export function toApplicationUrl (url, application) {
  const destination = new URL(url)
  destination.protocol = 'http:'
  destination.host = `${application}.plt.local`
  return destination
}
