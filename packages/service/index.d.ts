/// <reference types="@platformatic/types" />
import { FastifyInstance } from "fastify"
import ConfigManager from "@platformatic/config"

declare module '@platformatic/types' {
  interface PlatformaticApp {
    configManager: ConfigManager
    config: object
  }
}

export function buildServer(opts: object, app?: object, ConfigManagerContructor?: object): Promise<FastifyInstance>

declare module 'fastify' {
  interface FastifyInstance {
    restart(): Promise<void>
  }
}
