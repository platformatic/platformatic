import { createServer } from 'node:http'
import { Agent, request, setGlobalDispatcher } from 'undici'

function addHeader (headers) {
  if (Array.isArray(headers)) {
    headers.push('x-user-dispatcher', 'yes')
    return headers
  }

  return {
    ...headers,
    'x-user-dispatcher': 'yes'
  }
}

const httpClientInterceptor = dispatch => {
  return function interceptedDispatch (opts, handler) {
    opts.headers = addHeader(opts.headers)
    return dispatch(opts, handler)
  }
}

const httpDispatcher = new Agent({
  connections: 100,
  headersTimeout: 8_000,
  bodyTimeout: 8_000,
  allowH2: true,
  autoSelectFamily: true
}).compose(httpClientInterceptor)

setGlobalDispatcher(httpDispatcher)

const server = createServer(async (req, res) => {
  try {
    let payload

    if (req.url === '/fetch') {
      const response = await fetch('http://internal.plt.local/headers')
      payload = await response.json()
    } else if (req.url === '/request') {
      const response = await request('http://internal.plt.local/headers')
      payload = await response.body.json()
    } else if (req.url === '/external') {
      const response = await request(process.env.EXTERNAL_URL)
      payload = await response.body.json()
    } else {
      res.statusCode = 404
      res.end()
      return
    }

    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(payload))
  } catch (err) {
    res.statusCode = 500
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ code: err.code, message: err.message }))
  }
})

server.listen(0)
