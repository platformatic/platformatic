import fastify from 'fastify'

export function create () {
  const app = fastify()

  let status = true

  globalThis.platformatic.setCustomHealthCheck(async () => {
    return status
  })

  app.get('/', (req, res) => {
    res.send('Hello')
  })

  app.get('/set/status', (req, res) => {
    status = req.query.status === 'true'
    res.send('service status is now set to ' + status)
  })

  return app
}
