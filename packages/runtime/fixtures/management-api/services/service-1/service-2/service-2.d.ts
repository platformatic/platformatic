import { type FastifyReply, type FastifyPluginAsync } from 'fastify'
import { type GetHeadersOptions } from '@platformatic/client'

declare namespace service2 {
  export type Service2 = {
    getHello(req?: GetHelloRequest): Promise<GetHelloResponses>;
  }
  export interface Service2Options {
    url: string
  }
  export const service2: Service2Plugin;
  export { service2 as default };
  export interface FullResponse<T, U extends number> {
    'statusCode': U;
    'headers': Record<string, string>;
    'body': T;
  }

  export type GetHelloRequest = {
    unknown
  }

  export type GetHelloResponseOK = unknown
  export type GetHelloResponses =
    FullResponse<GetHelloResponseOK, 200>

}

type Service2Plugin = FastifyPluginAsync<NonNullable<service2.Service2Options>>

declare module 'fastify' {
  interface ConfigureService2 {
    getHeaders(req: FastifyRequest, reply: FastifyReply, options: GetHeadersOptions): Promise<Record<string,string>>;
  }
  interface FastifyInstance {
    configureService2(opts: ConfigureService2): unknown
  }

  interface FastifyRequest {
    'service2': service2.Service2;
  }
}

declare function service2(...params: Parameters<Service2Plugin>): ReturnType<Service2Plugin>;
export = service2;
