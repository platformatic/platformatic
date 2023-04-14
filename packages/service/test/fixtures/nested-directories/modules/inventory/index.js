import fp from 'fastify-plugin'
import autoload from '@fastify/autoload'
import { join } from 'desm'

class Inventory {
  async howManyInStore (sku) {
    if (sku === 42) {
      return 2
    } else {
      return 0
    }
  }
}

async function inventory (fastify, opts) {
  // This will be published to the root fastify instance
  // it could also be extracted to a separate plugin
  fastify.decorate('inventory', new Inventory())

  // These routes would be created in their own child instances
  fastify.register(autoload, {
    dir: join(import.meta.url, 'routes'),
    options: {
      prefix: opts.prefix
    }
  })
}

export default fp(inventory)
