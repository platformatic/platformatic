import { getLogger, setCustomHealthCheck } from '@platformatic/globals'
import fastify from 'fastify'

export function create () {
  const app = fastify({ loggerInstance: getLogger() })

  setCustomHealthCheck(async () => {
    return true
  })

  app.get('/', (req, res) => {
    res.send('Hello')
  })

  app.post('/fail', (req, res) => {
    setCustomHealthCheck(() => {
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
