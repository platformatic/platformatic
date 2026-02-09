import fastify from 'fastify'

export function create () {
  const app = fastify({ loggerInstance: globalThis.platformatic.logger })

  globalThis.platformatic.setCustomHealthCheck(async () => {
    return true
  })

  app.get('/', (req, res) => {
    res.send('Hello')
  })

  app.post('/fail', (req, res) => {
    globalThis.platformatic.setCustomHealthCheck(() => {
      return new Promise(resolve => {
        const t = setTimeout(() => {
          resolve(false)
        }, 30000)

        t.unref()
      })
    })

    return 'Health check will now fail'
  })

  return app
}
