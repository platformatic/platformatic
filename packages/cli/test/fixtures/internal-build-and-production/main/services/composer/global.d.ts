
import { FastifyInstance } from 'fastify'
import { PlatformaticApp, PlatformaticComposerConfig } from '@platformatic/composer'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApp<PlatformaticComposerConfig>
  }
}
