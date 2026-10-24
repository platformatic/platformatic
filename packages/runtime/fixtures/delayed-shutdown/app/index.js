import { setTimeout as sleep } from 'node:timers/promises'

export default async function (app) {
  app.addHook('onClose', async () => {
    await sleep(11000)

    console.log('clean up hook')
  })
}
