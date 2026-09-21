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

  return app
}
