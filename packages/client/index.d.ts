import { FastifyPluginAsync } from 'fastify'

interface Headers {
  [key: string]: string
}

interface PlatformaticClientPluginOptions {
  url: string;
  path?: string;
  headers?: object;
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
  [Symbol('headers')]: Headers; 
}

interface BuildOpenAPIClientOutput {
  [key: string]: {
    statusCode: number;
    headers: Headers[];
    body: any
  } | any
  [Symbol('headers')]: Headers; 
}
export function generateOperationId(path: string, method: string, methodMeta: MethodMetaInterface): string
export async function buildOpenAPIClient(options: BuildOpenAPIClientOptions, openTelemetry: any): Promise<BuildOpenAPIClientOutput>
export async function buildGraphQLClient(options?: BuildGraphQLClientOptions, openTelemetry: any, logger: AbstractLogger): Promise<BuildGraphQLClientOutput>

export const plugin: FastifyPluginAsync<PlatformaticClientPluginOptions>
export default plugin
