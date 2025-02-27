import fastify from 'fastify'

export function create () {
  const app = fastify()

  let status = true

  globalThis.platformatic.setCustomHealthCheck(async () => {
    return status
  })

  app.get('/', (req, res) => {
    res.send('Hello World')
  })

  app.get('/set/status', (req, res) => {
    status = req.query.status === 'true'
    res.send('Status set')
  })

  return app
}
