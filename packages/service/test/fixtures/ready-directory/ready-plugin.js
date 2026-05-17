import { setTimeout as sleep } from 'node:timers/promises'

export default async function (app) {
  app.ready(async function () {})

  // Keep a tiny async gap so the test still exercises plugin readiness without
  // depending on a long timer that can make CI scheduling more brittle.
  await sleep(10)
}
