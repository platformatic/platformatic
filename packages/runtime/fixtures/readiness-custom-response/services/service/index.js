import fastify from 'fastify'

export function create () {
  const app = fastify()

  const readiness = {
    status: true,
    body: 'All ready',
    statusCode: 200
  }
  const health = {
    status: true,
    body: 'All healthy',
    statusCode: 200
  }

  globalThis.platformatic.setCustomReadinessCheck(async () => {
    return readiness
  })

  globalThis.platformatic.setCustomHealthCheck(async () => {
    return health
  })

  app.get('/', (req, res) => {
    res.send('Hello')
  })

  app.get('/set/ready', (req, res) => {
    readiness.status = req.query.status === 'true'
    readiness.body = req.query.body
    readiness.statusCode = req.query.statusCode
    res.send('service status is now set to ' + readiness.status + ' and body to ' + readiness.body + ' and status code to ' + readiness.statusCode)
  })

  app.get('/set/health', (req, res) => {
    health.status = req.query.status === 'true'
    health.body = req.query.body
    health.statusCode = req.query.statusCode
    res.send('service status is now set to ' + health.status + ' and body to ' + health.body + ' and status code to ' + health.statusCode)
  })

  return app
}
