import { InjectOptions, LightMyRequestResponse } from 'fastify'

export type pltRuntimeBuildServer = {
  address: string
  port: number
  restart: () => Promise<void>
  stop: () => Promise<void>
  inject: (opts: InjectOptions | string) => Promise<LightMyRequestResponse>
}

declare module '@platformatic/runtime' {
  export function buildServer(opts: object): Promise<pltRuntimeBuildServer>
}
