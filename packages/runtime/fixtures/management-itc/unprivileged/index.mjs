import { hasField } from '@platformatic/globals'
import fastify from 'fastify'

export function create () {
  const app = fastify()

  app.get('/has-management', async () => {
    return { has: hasField('management') }
  })

  app.get('/hello', async () => {
    return { service: 'unprivileged' }
  })

  return app
}
