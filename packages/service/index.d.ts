/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference types="@platformatic/types" />
/// <reference types="mercurius" />
/// <reference types="@fastify/swagger" />
import { FastifyInstance } from 'fastify'
import ConfigManager from '@platformatic/config'
import { PlatformaticService } from './config'

declare module '@platformatic/types' {
  interface PlatformaticApp {
    configManager: ConfigManager<PlatformaticService>
    config: PlatformaticService
  }
}

export function buildServer (opts: object, app?: object, ConfigManagerContructor?: object): Promise<FastifyInstance>

declare module 'fastify' {
  interface FastifyInstance {
    restart: () => Promise<void>
  }
}
