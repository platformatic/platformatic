import { PlatformaticApp, PlatformaticGatewayConfig } from '@platformatic/gateway'
import 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApp<PlatformaticGatewayConfig>
  }
}
