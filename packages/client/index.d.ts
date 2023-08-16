import { FastifyPluginAsync, FastifyRequest } from 'fastify'

interface Headers {
  [key: string]: string
}

export type PlatformaticClientPluginOptions = {
  url: string;
  path?: string;
  headers?: Headers;
  throwOnError: boolean;
  fullResponse: boolean;
  type: 'openapi' | 'graphql';
  name?: string;
  serviceId?: string;
  getHeaders?: (request?: FastifyRequest) => Headers;
}

interface BuildOpenAPIClientOptions {
  url: string;
  path: string;
  headers?: Headers
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

export function generateOperationId(path: string, method: string, methodMeta: MethodMetaInterface): string
export function buildOpenAPIClient<T>(options: BuildOpenAPIClientOptions, openTelemetry: OpenTelemetry): Promise<T>
export function buildGraphQLClient(options: BuildGraphQLClientOptions, openTelemetry: OpenTelemetry, logger: AbstractLogger): Promise<BuildGraphQLClientOutput>

export const plugin: FastifyPluginAsync<PlatformaticClientPluginOptions>
export default plugin
