import { getManagement, hasField } from '@platformatic/globals'
import fastify from 'fastify'

export function create () {
  const app = fastify()

  app.get('/has-management', async () => {
    return { has: hasField('management') }
  })

  app.get('/status', async () => {
    const management = getManagement()
    const status = await management.getRuntimeStatus()
    return { status }
  })

  app.get('/applications-ids', async () => {
    const management = getManagement()
    const ids = await management.getApplicationsIds()
    return { ids }
  })

  app.get('/applications/:id', async (req) => {
    const management = getManagement()
    return management.getApplicationDetails(req.params.id)
  })

  // This should fail - not in allowed operations
  app.get('/config', async () => {
    try {
      const management = getManagement()
      return await management.getRuntimeConfig()
    } catch (err) {
      return { error: err.message }
    }
  })

  return app
}
