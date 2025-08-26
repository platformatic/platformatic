import { setTimeout as sleep } from 'node:timers/promises'

export default async function service1 (app) {
  await sleep(2000)

  app.get('/check', async () => {
    return { service1: true }
  })
}
