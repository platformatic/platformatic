import autoload from '@fastify/autoload'
import { join } from 'node:path'

export default async function catalogue (app, opts) {
  app.register(autoload, {
    dir: join(import.meta.dirname, 'routes'),
    options: {
      prefix: opts.prefix
    }
  })
}
