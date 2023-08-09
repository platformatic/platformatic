import { FastifyPluginAsync } from 'fastify'

interface Headers {
  [key: string]: string
}

interface PlatformaticClientPluginOptions {
  url: string;
  path?: string;
  headers?: Headers;
  throwOnError: boolean;
  fullResponse: boolean;
  type: 'openapi' | 'graphql';
  name?: string;
  serviceId?: string;
  getHeaders?: () => Headers;
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
  graphql: () => Promise<unkown>;
}

interface BuildOpenAPIClientOutput {
  [key: string]: {
    statusCode: number;
    headers: Headers[];
    body: object
  } | object
  [Symbol('headers')]: Headers; 
}

type OpenTelemetry = {
  startSpanClient?: (urlToCall: URL, method: string, telemetryContext: any) => object
  endSpanClient?: (span: any, res: any) => void
  setErrorInSpanClient?: (span: any, err: unknown) => void
}

export function generateOperationId(path: string, method: string, methodMeta: MethodMetaInterface): string
export async function buildOpenAPIClient(options: BuildOpenAPIClientOptions, openTelemetry: OpenTelemetry): Promise<BuildOpenAPIClientOutput>
export async function buildGraphQLClient(options?: BuildGraphQLClientOptions, openTelemetry: OpenTelemetry, logger: AbstractLogger): Promise<BuildGraphQLClientOutput>

export const plugin: FastifyPluginAsync<PlatformaticClientPluginOptions>
export default plugin
