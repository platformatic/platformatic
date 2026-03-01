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

  app.get('/applications-ids', async () => {
    const ids = await globalThis.platformatic.management.getApplicationsIds()
    return { ids }
  })

  app.get('/applications/:id', async (req) => {
    return globalThis.platformatic.management.getApplicationDetails(req.params.id)
  })

  // This should fail - not in allowed operations
  app.get('/config', async () => {
    try {
      return await globalThis.platformatic.management.getRuntimeConfig()
    } catch (err) {
      return { error: err.message }
    }
  })

  return app
}
