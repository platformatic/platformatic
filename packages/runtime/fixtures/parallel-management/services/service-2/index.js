import { setTimeout as sleep } from 'node:timers/promises'

export default async function service1 (app) {
  await sleep(500)

  // This will fail if the service-1 is not already started
  const response = await fetch('http://service-1.plt.local/check')
  const json = await response.json()

  app.get('/check', async () => {
    return json
  })
}
