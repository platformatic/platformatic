import fastifyStatic from '@fastify/static'
import { join } from 'node:path'

export default async function (app) {
  app.register(fastifyStatic, {
    root: join(import.meta.dirname, 'hello')
  })
}
