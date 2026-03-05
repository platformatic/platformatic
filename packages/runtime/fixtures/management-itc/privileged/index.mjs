import fastify from 'fastify'

export function create () {
  const app = fastify()

  app.get('/has-management', async () => {
    return { has: !!globalThis.platformatic.management }
  })

  app.get('/status', async () => {
    const status = await globalThis.platformatic.management.getRuntimeStatus()
    return { status }
  })

  app.get('/metadata', async () => {
    return globalThis.platformatic.management.getRuntimeMetadata()
  })

  app.get('/config', async () => {
    return globalThis.platformatic.management.getRuntimeConfig()
  })

  app.get('/env', async () => {
    return globalThis.platformatic.management.getRuntimeEnv()
  })

  app.get('/applications-ids', async () => {
    const ids = await globalThis.platformatic.management.getApplicationsIds()
    return { ids }
  })

  app.get('/applications', async () => {
    return globalThis.platformatic.management.getApplications()
  })

  app.get('/workers', async () => {
    return globalThis.platformatic.management.getWorkers()
  })

  app.get('/applications/:id', async (req) => {
    return globalThis.platformatic.management.getApplicationDetails(req.params.id)
  })

  app.get('/applications/:id/config', async (req) => {
    return globalThis.platformatic.management.getApplicationConfig(req.params.id)
  })

  app.get('/applications/:id/env', async (req) => {
    return globalThis.platformatic.management.getApplicationEnv(req.params.id)
  })

  app.post('/applications/:id/restart', async (req) => {
    await globalThis.platformatic.management.restartApplication(req.params.id)
    return { ok: true }
  })

  app.post('/inject', async (req) => {
    const { id, ...injectParams } = req.body
    return globalThis.platformatic.management.inject(id, injectParams)
  })

  return app
}
