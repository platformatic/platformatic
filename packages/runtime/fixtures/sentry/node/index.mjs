import { getLogger } from '@platformatic/globals'
import { createServer } from 'node:http'

const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal']

const server = createServer((req, res) => {
  const logger = getLogger()

  for (const level of levels) {
    logger[level]({ method: req.method, url: req.url }, `sentry fixture ${level} log`)
  }

  res.writeHead(200, {
    'content-type': 'application/json',
    connection: 'close'
  })
  res.end(JSON.stringify({ ok: true }))
})

server.listen(0)
