// @ts-expect-error
import { cleanBasePath, ensureTrailingSlash } from '@platformatic/basic'
import { getGlobal } from '@platformatic/globals'
import { createServer } from 'node:http'

const platformatic = getGlobal()
const prefix = platformatic.basePath ?? ''

const server = createServer((req, res) => {
  if (req.url === ensureTrailingSlash(cleanBasePath(prefix))) {
    res.writeHead(200, {
      'content-type': 'application/json',
      connection: 'close',
      'x-plt-worker-id': platformatic.workerId
    })
    res.end(JSON.stringify({ production: process.env.NODE_ENV === 'production' }))
  } else {
    res.writeHead(404, {
      'content-type': 'application/json',
      connection: 'close'
    })
    res.end(JSON.stringify({ ok: false }))
  }
})

// This would likely fail if our code doesn't work
server.listen(1)
