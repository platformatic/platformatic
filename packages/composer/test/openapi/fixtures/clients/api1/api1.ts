import { FastifyPluginAsync } from 'fastify'

interface GetRequest {
}

interface GetResponse {
}

interface Api1 {
  get(req: GetRequest): Promise<GetResponse>;
}

type Api1Plugin = FastifyPluginAsync<NonNullable<api1.Api1Options>>

declare module 'fastify' {
  interface FastifyInstance {
    'api1': Api1;
  }

  interface FastifyRequest {
    'api1': Api1;
  }
}

declare namespace api1 {
  export interface Api1Options {
    url: string
  }
  export const api1: Api1Plugin;
  export { api1 as default };
}

declare function api1(...params: Parameters<Api1Plugin>): ReturnType<Api1Plugin>;
export = api1;
