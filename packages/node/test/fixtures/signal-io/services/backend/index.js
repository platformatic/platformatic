import { getMessaging } from '@platformatic/globals'
import { createServer } from 'node:http'
import { setTimeout as sleep } from 'node:timers/promises'

getMessaging().handle('ping', async () => {
  await sleep(100)
  return 'pong'
})

export function create () {
  return createServer(async (req, res) => {
    await sleep(100)
    res.write('po')
    await sleep(100)
    res.end('ng')
  })
}
