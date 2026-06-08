import { getEvents } from '@platformatic/globals'
import { createServer } from 'node:http'

const server = createServer((_, res) => {
  res.end(JSON.stringify({ production: process.env.NODE_ENV === 'production' }))
})

server.listen(0)

export function close () {
  const events = getEvents()
  events.emitAndNotify('close:function')
}
