module.exports = async function (fastify) {
  fastify.get('/example', async () => {
    return { hello: fastify.example }
  })

  fastify.get('/mesh', async () => {
    const meta = await globalThis[Symbol.for('plt.runtime.itc')].send('getApplicationMeta', 'composer')

    const url = new URL(
      `${meta.composer.proxies.frontend.rewritePrefix}/direct`.replaceAll(/\/+/g, '/'),
      'http://frontend.plt.local'
    )
    const response = await fetch(url)
    return response.json()
  })

  fastify.get('/time', async () => {
    return { time: Date.now() }
  })

  fastify.get('/time-alternative', async () => {
    return { time: Date.now() }
  })
}
