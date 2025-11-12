import fastify from 'fastify'

export function create () {
  process._rawDebug('Creating fail-timeout app...')
  const app = fastify({ loggerInstance: globalThis.platformatic.logger })

  globalThis.platformatic.setCustomHealthCheck(async () => {
    return true
  })

  process._rawDebug('Defining routes...')

  app.get('/', (req, res) => {
    res.send('Hello')
  })

  app.post('/fail', (req, res) => {
    globalThis.platformatic.setCustomHealthCheck(() => {

      return new Promise((resolve) => {
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
