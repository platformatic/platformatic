import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { FastifyError } from '@fastify/error'

interface Headers {
  [key: string]: string
}

export type PlatformaticClientPluginOptions = {
  url: string;
  path?: string;
  headers?: Headers;
  throwOnError: boolean;
  fullRequest: boolean;
  fullResponse: boolean;
  validateResponse?: boolean;
  type: 'openapi' | 'graphql';
  name?: string;
  serviceId?: string;
  getHeaders?: (request: FastifyRequest, reply: FastifyReply, options: { url: URL, method: string, headers: Headers, telemetryHeaders?: Headers, body: object }) => Promise<Headers>;
}

interface BuildOpenAPIClientOptions {
  url: string;
  path: string;
  headers?: Headers,
  validateResponse?: boolean
}

interface AbstractLogger {
  fatal: () => void;
  error: () => void;
  warn: () => void;
  info: () => void;
  debug: () => void;
  trace: () => void;
}

interface BuildGraphQLClientOptions {
  url: string;
  headers?: Headers;
}

interface Parameter {
  in: string;
  name: string;
}

interface MethodMetaInterface {
  operationId?: string,
  parameters: Parameter[]
}

interface BuildGraphQLClientOutput {
  graphql: <T>() => Promise<T>;
}

type OpenTelemetry = {
  startSpanClient?: (urlToCall: URL, method: string, telemetryContext: any) => object
  endSpanClient?: (span: any, res: any) => void
  setErrorInSpanClient?: (span: any, err: unknown) => void
}

export function generateOperationId(path: string, method: string, methodMeta: MethodMetaInterface, all: string[]): string
export function buildOpenAPIClient<T>(options: BuildOpenAPIClientOptions, openTelemetry: OpenTelemetry): Promise<T>
export function buildGraphQLClient(options: BuildGraphQLClientOptions, openTelemetry: OpenTelemetry, logger: AbstractLogger): Promise<BuildGraphQLClientOutput>
export function hasDuplicatedParameters(methodMeta: MethodMetaInterface): boolean

export const plugin: FastifyPluginAsync<PlatformaticClientPluginOptions>
export default plugin

/**
 * All the errors thrown by the plugin.
 */
export module errors {
  export const OptionsUrlRequiredError: () => FastifyError
}

