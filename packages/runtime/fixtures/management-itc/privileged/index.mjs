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

  app.get('/metadata', async () => {
    const management = getManagement()
    return management.getRuntimeMetadata()
  })

  app.get('/config', async () => {
    const management = getManagement()
    return management.getRuntimeConfig()
  })

  app.get('/env', async () => {
    const management = getManagement()
    return management.getRuntimeEnv()
  })

  app.get('/applications-ids', async () => {
    const management = getManagement()
    const ids = await management.getApplicationsIds()
    return { ids }
  })

  app.get('/applications', async () => {
    const management = getManagement()
    return management.getApplications()
  })

  app.get('/workers', async () => {
    const management = getManagement()
    return management.getWorkers()
  })

  app.get('/applications/:id', async (req) => {
    const management = getManagement()
    return management.getApplicationDetails(req.params.id)
  })

  app.get('/applications/:id/config', async (req) => {
    const management = getManagement()
    return management.getApplicationConfig(req.params.id)
  })

  app.get('/applications/:id/env', async (req) => {
    const management = getManagement()
    return management.getApplicationEnv(req.params.id)
  })

  app.post('/applications/:id/restart', async (req) => {
    const management = getManagement()
    await management.restartApplication(req.params.id)
    return { ok: true }
  })

  app.post('/inject', async (req) => {
    const { id, ...injectParams } = req.body
    const management = getManagement()
    return management.inject(id, injectParams)
  })

  return app
}
