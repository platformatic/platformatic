import { FastifyInstance } from "fastify"

export type pltServiceHandlerBuildServer = {
  app: FastifyInstance
  address: string
  port: number
  restart: () => Promise<void>
  listen: FastifyInstance['listen']
  close: FastifyInstance['close']
  inject: FastifyInstance['inject']
}

declare module '@platformatic/service' {
  export function buildServer(opts: object, app?: object, ConfigManagerContructor?: object): Promise<pltServiceHandlerBuildServer>
}
