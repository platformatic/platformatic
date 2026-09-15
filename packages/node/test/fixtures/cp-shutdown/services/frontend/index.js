import { getEvents, registerCloseCallback } from '@platformatic/globals'
import { createServer } from 'node:http'
import { setTimeout as sleep } from 'node:timers/promises'

const events = getEvents()
const server = createServer((req, res) => res.end(JSON.stringify({ pid: process.pid })))
server.listen(0)
registerCloseCallback(async () => {
  if (process.env.SHUTDOWN_MODE === 'child-hang') {
    await new Promise(() => {})
  }
  await sleep(20)
  events.emitAndNotify('shutdown:step', 'child:callback')
})
process.once('SIGINT', async () => {
  if (process.env.SHUTDOWN_MODE !== 'open-resource') {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
  events.emitAndNotify('shutdown:step', 'child:signal')
})
