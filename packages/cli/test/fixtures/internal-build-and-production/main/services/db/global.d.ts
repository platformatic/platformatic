
import { FastifyInstance } from 'fastify'
import { PlatformaticApp, PlatformaticDBConfig, PlatformaticDBMixin, Entities } from '@platformatic/db'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApp<PlatformaticDBConfig> & PlatformaticDBMixin<Entities>
  }
}
