'use strict'

const kFields = Symbol.for('plt.globals.fields')
const statsGlobals = [
  'onHttpStatsFree',
  'onHttpStatsConnected',
  'onHttpStatsPending',
  'onHttpStatsQueued',
  'onHttpStatsRunning',
  'onHttpStatsSize'
]

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app, options) {
  app.get('/hello', async () => {
    return { service: 'service-1' }
  })

  // Simulate a capability built with an older @platformatic/basic, which assigned
  // the http stats globals directly without registering them in the fields set.
  app.get('/simulate-legacy-globals', async () => {
    for (const name of statsGlobals) {
      globalThis.platformatic[kFields].delete(name)
    }

    return { ok: true }
  })
}
