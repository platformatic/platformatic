import { FastifyInstance, InjectOptions, LightMyRequestResponse } from "fastify"

declare module '@platformatic/service' {
  export type pltBuiltServer = {
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

  export function buildServer(opts: object, app?: object, ConfigManagerContructor?: object): Promise<pltBuiltServer>
}
