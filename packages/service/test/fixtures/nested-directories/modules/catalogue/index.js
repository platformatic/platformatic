import autoload from '@fastify/autoload'
import { join } from 'desm'

export default async function catalogue (app, opts) {
  app.register(autoload, {
    dir: join(import.meta.url, 'routes'),
    options: {
      prefix: opts.prefix
    }
  })
}
