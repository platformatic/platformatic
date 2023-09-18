/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference types="mercurius" />
/// <reference types="@fastify/swagger" />
import { FastifyInstance } from 'fastify'
import ConfigManager from '@platformatic/config'
import { PlatformaticService } from './config'

export interface PlatformaticApp<T> {
  configManager: ConfigManager<T>
  config: T
}

export type PlatformaticServiceConfig = PlatformaticService

export function buildServer (opts: object, app?: object, ConfigManagerContructor?: object): Promise<FastifyInstance>

declare module 'fastify' {
  interface FastifyInstance {
    restart: () => Promise<void>
  }
}
