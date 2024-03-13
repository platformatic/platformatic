import { FastifyPluginAsync } from 'fastify'

interface GetRequest {
}

interface GetResponse {
}

interface Hello {
  get(req: GetRequest): Promise<GetResponse>;
}

type HelloPlugin = FastifyPluginAsync<NonNullable<hello.HelloOptions>>

declare module 'fastify' {
  interface FastifyInstance {
    'hello': Hello;
  }

  interface FastifyRequest {
    'hello': Hello;
  }
}

declare namespace hello {
  export interface HelloOptions {
    url: string
  }
  export const hello: HelloPlugin;
  export { hello as default };
}

declare function hello(...params: Parameters<HelloPlugin>): ReturnType<HelloPlugin>;
export = hello;
