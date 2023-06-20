import { FastifyInstance } from 'fastify'

export interface PlatformaticApp {
}

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApp
  }
}

