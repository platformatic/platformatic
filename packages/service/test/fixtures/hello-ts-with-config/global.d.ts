import { PlatformaticApp, PlatformaticServiceConfig } from '../../../index'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApp<PlatformaticServiceConfig>
  }
}
