'use strict'

export default async function (app) {
  app.get('/mesh', async () => {
    const meta = await globalThis[Symbol.for('plt.runtime.itc')].send('getServiceMeta', 'frontend')

    const url = new URL(`${meta.composer.prefix}/direct`.replaceAll(/\/+/g, '/'), 'http://frontend.plt.local')
    const response = await fetch(url)
    return response.json()
  })

  app.get('/direct', async () => {
    return { ok: true }
  })

  app.get('/time', async () => {
    return { time: Date.now() }
  })
}
