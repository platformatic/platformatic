import { FastifyPluginAsync } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    rpc(handlerName: string, handler: Function): void
  }
}

interface FastifyRpcOptions {
  prefix?: string;
  openapi: object;
}

declare const fastifyRpcPlugin: FastifyPluginAsync<FastifyRpcOptions>
export default fastifyRpcPlugin
