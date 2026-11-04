import { BaseCapability } from '@platformatic/basic'
import { Configuration, ConfigurationOptions } from '@platformatic/foundation'
import {
  ServiceCapability,
  Generator as ServiceGenerator,
  ServerInstance as ServiceServerInstance
} from '@platformatic/service'
import { JSONSchemaType } from 'ajv'
import { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { FastifyReplyFromHooks } from '@fastify/reply-from'
import type { OutgoingHttpHeaders } from 'node:http'
import type { Readable } from 'node:stream'
import type { PlatformaticGatewayConfig } from './config.d.ts'

export interface GatewayCommand {
  usage: string
  description: string
}

export declare const kGatewayProxyResponseHandler: unique symbol

export interface ProxyResponse {
  statusCode: number
  headers: OutgoingHttpHeaders
  stream: Readable
}

export interface ProxyResponseHandler {
  /** Own the per-client stream. The gateway does not send it or await this callback. */
  onResponse (response: ProxyResponse): void
}

export type ProxyHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
  destination: string,
  options: FastifyReplyFromHooks
) => unknown

export type SendProxyResponse = (request: FastifyRequest, reply: FastifyReply, stream: Readable) => unknown
export interface WrappingHandlerContext {
  next: ProxyHandler
  send: SendProxyResponse
}

export type WrappingHandler = (
  context: WrappingHandlerContext,
  request: FastifyRequest,
  reply: FastifyReply,
  destination: string,
  options: FastifyReplyFromHooks
) => unknown

declare module 'fastify' {
  interface FastifyReply {
    [kGatewayProxyResponseHandler]?: ProxyResponseHandler
  }
}

export interface GatewayCommandDefinition {
  commands: Record<string, (...args: unknown[]) => Promise<void> | void>
  help: Record<string, GatewayCommand>
}

export type { PlatformaticServiceConfig } from '@platformatic/service'
export type { PlatformaticGatewayConfig } from './config.d.ts'

export type GatewayCapability = ServiceCapability<PlatformaticGatewayConfig>

export type ServerInstance = ServiceServerInstance<PlatformaticGatewayConfig>

type GatewayConfiguration = Configuration<PlatformaticGatewayConfig>

export declare function loadConfiguration (
  root: string | PlatformaticGatewayConfig,
  source?: string | PlatformaticGatewayConfig,
  context?: ConfigurationOptions
): Promise<GatewayConfiguration>

export function create (
  root: string | PlatformaticGatewayConfig,
  source?: string | PlatformaticGatewayConfig,
  context?: ConfigurationOptions
): Promise<GatewayCapability>

export declare function platformaticGateway (app: FastifyInstance, capability: BaseCapability): Promise<void>

export declare function createCommands (id: string): GatewayCommandDefinition

export class Generator extends ServiceGenerator {}

export declare const packageJson: Record<string, unknown>

export declare const schema: JSONSchemaType<PlatformaticGatewayConfig>

export declare const schemaComponents: {
  openApiApplication: JSONSchemaType<object>
  entityResolver: JSONSchemaType<object>
  entities: JSONSchemaType<object>
  graphqlApplication: JSONSchemaType<object>
  graphqlComposerOptions: JSONSchemaType<object>
  gateway: JSONSchemaType<object>
  types: JSONSchemaType<object>
}

export declare const skipTelemetryHooks: boolean

export declare const version: string

export namespace errors {
  export const FastifyInstanceIsAlreadyListeningError: () => FastifyError
  export const FailedToFetchOpenAPISchemaError: () => FastifyError
  export const ValidationErrors: () => FastifyError
  export const PathAlreadyExistsError: () => FastifyError
  export const CouldNotReadOpenAPIConfigError: () => FastifyError
}
