import { FastifyPluginAsync } from 'fastify'

interface GetRequest {
}

interface GetResponse {
}

interface ServiceDb {
  get(req: GetRequest): Promise<GetResponse>;
}

type ServiceDbPlugin = FastifyPluginAsync<NonNullable<serviceDb.ServiceDbOptions>>

declare module 'fastify' {
  interface ConfigureServiceDb {
    getHeaders(req: FastifyRequest, reply: FastifyReply): Promise<Record<string, string>>;
  }
  interface FastifyInstance {
    serviceDb: ServiceDb;
    configureServiceDb(opts: ConfigureServiceDb): unknown
  }

  interface FastifyRequest {
    serviceDb: ServiceDb;
  }
}

declare namespace serviceDb {
  export interface ServiceDbOptions {
    url: string
  }
  export const serviceDb: ServiceDbPlugin
  export { serviceDb as default }
}

declare function serviceDb (...params: Parameters<ServiceDbPlugin>): ReturnType<ServiceDbPlugin>
export = serviceDb
