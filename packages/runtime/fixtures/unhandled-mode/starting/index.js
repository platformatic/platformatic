import { setTimeout as sleep } from 'node:timers/promises'

export default async function () {
  // Raise a rejection nobody observes while the controller is still in the "starting" state.
  Promise.reject(new Error('UNHANDLED'))

  // Never finish starting, so that the controller cannot reach the "started" state before the
  // unhandled rejection above is delivered. The worker is expected to exit within a few hundred
  // milliseconds, long before this resolves, and the runtime gives up on its startTimeout long
  // before it too.
  //
  // This sleep is longer than fastify's default pluginTimeout, which nothing overrides here. That
  // is harmless because startTimeout expires first, but it is one more reason not to raise
  // startTimeout: past the plugin timeout the boot would fail on the plugin rather than on the
  // defect under test.
  await sleep(30000)
}
