import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { Dispatcher } from 'undici'

interface Headers {
  [key: string]: string
}

export interface GetHeadersOptions {
  url: URL
  method: string
  body: object
  headers: Headers
  telemetryHeaders?: Headers
}

interface PlatformaticClientOptions {
  url: string
  path?: string
  fullResponse: boolean
  fullRequest: boolean
  throwOnError: boolean
  headers?: Headers
  bodyTimeout?: number
  headersTimeout?: number
  validateResponse?: boolean
  queryParser?: (query: URLSearchParams) => string
  dispatcher?: Dispatcher
}

export type PlatformaticClientPluginOptions = PlatformaticClientOptions & {
  type: 'openapi' | 'graphql'
  name?: string
  serviceId?: string
  getHeaders?: (request: FastifyRequest, reply: FastifyReply, options: GetHeadersOptions) => Promise<Headers>
}

export const plugin: FastifyPluginAsync<PlatformaticClientPluginOptions>
export default plugin
