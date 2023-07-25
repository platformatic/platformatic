/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference types="@platformatic/sql-mapper" />
/// <reference types="@platformatic/sql-graphql" />
/// <reference types="@platformatic/sql-openapi" />
import ConfigManager from '@platformatic/config'
import { FastifyInstance } from 'fastify'
import { PlatformaticDB } from './config'

declare module '@platformatic/types' {
  interface PlatformaticApp {
    configManager: ConfigManager<PlatformaticDB>
    config: PlatformaticDB
  }
}

export function buildServer (opts: object, app?: object, ConfigManagerContructor?: object): Promise<FastifyInstance>

declare module 'fastify' {
  interface FastifyInstance {
    restart: () => Promise<void>
  }
}
