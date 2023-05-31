import { FastifyPluginAsync } from 'fastify'

interface GetRequest {
}

interface GetResponse {
}

interface WithLogger {
  get(req: GetRequest): Promise<GetResponse>;
}

type WithLoggerPlugin = FastifyPluginAsync<NonNullable<withLogger.WithLoggerOptions>>

declare module 'fastify' {
  interface ConfigureWithLogger {
    async getHeaders(req: FastifyRequest, reply: FastifyReply): Promise<Record<string,string>>;
  }
  interface FastifyInstance {
    'withLogger': WithLogger;
    configureWithLogger(opts: ConfigureWithLogger): unknown
  }

  interface FastifyRequest {
    'withLogger': WithLogger;
  }
}

declare namespace withLogger {
  export interface WithLoggerOptions {
    url: string
  }
  export const withLogger: WithLoggerPlugin;
  export { withLogger as default };
}

declare function withLogger(...params: Parameters<WithLoggerPlugin>): ReturnType<WithLoggerPlugin>;
export = withLogger;
