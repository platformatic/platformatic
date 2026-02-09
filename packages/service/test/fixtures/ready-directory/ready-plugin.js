import { setTimeout as sleep } from 'node:timers/promises'

export default async function (app) {
  app.ready(async function () {})

  await sleep(1000)
}
