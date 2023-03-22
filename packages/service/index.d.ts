import { FastifyInstance, InjectOptions, LightMyRequestResponse } from "fastify"

export type pltServiceHandlerBuildServer = {
  app: FastifyInstance
  address: string
  port: number
  restart: () => Promise<void>
  listen: () => Promise<{
    address: string
    port: number
  }>
  stop: () => Promise<void>
  inject: (opts: InjectOptions | string) => Promise<LightMyRequestResponse>
}

declare module '@platformatic/service' {
  export function buildServer(opts: object, app?: object, ConfigManagerContructor?: object): Promise<pltServiceHandlerBuildServer>
}
