import fastify from 'fastify'

export function create () {
  const app = fastify()

  let status = true
  let body = 'All right'
  let statusCode = 201

  globalThis.platformatic.setCustomHealthCheck(async () => {
    return { status, body, statusCode }
  })

  app.get('/', (req, res) => {
    res.send('Hello')
  })

  app.get('/set/status', (req, res) => {
    status = req.query.status === 'true'
    body = req.query.body
    statusCode = req.query.statusCode
    res.send('service status is now set to ' + status + ' and body to ' + body + ' and status code to ' + statusCode)
  })

  return app
}
