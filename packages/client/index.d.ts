import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { FastifyError } from '@fastify/error'

type Enumerate<
  N extends number,
  Acc extends number[] = [],
> = Acc["length"] extends N
  ? Acc[number]
  : Enumerate<N, [...Acc, Acc["length"]]>;
type IntRange<F extends number, T extends number> = Exclude<
  Enumerate<T>,
  Enumerate<F>
>;

export type StatusCode1xx = IntRange<100, 200>;
export type StatusCode2xx = IntRange<200, 300>;
export type StatusCode3xx = IntRange<300, 400>;
export type StatusCode4xx = IntRange<400, 500>;
export type StatusCode5xx = IntRange<500, 600>;

interface Headers {
  [key: string]: string
}

export interface GetHeadersOptions {
  url: URL;
  method: string;
  body: object;
  headers: Headers;
  telemetryHeaders?: Headers;
}

interface PlatformaticClientOptions {
  url: string;
  path?: string;
  fullResponse: boolean;
  fullRequest: boolean;
  throwOnError: boolean;
  headers?: Headers;
  validateResponse?: boolean;
  queryParser?: (query: URLSearchParams) => string
}

type BuildOpenAPIClientOptions  = PlatformaticClientOptions & {
  getHeaders?: (options: GetHeadersOptions) => Promise<Headers>;
}

export type PlatformaticClientPluginOptions = PlatformaticClientOptions & {
  type: 'openapi' | 'graphql';
  name?: string;
  serviceId?: string;
  getHeaders?: (request: FastifyRequest, reply: FastifyReply, options: GetHeadersOptions) => Promise<Headers>;
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
export function buildOpenAPIClient<T>(options: BuildOpenAPIClientOptions, openTelemetry?: OpenTelemetry): Promise<T>
export function buildGraphQLClient(options: BuildGraphQLClientOptions, openTelemetry?: OpenTelemetry, logger?: AbstractLogger): Promise<BuildGraphQLClientOutput>
export function hasDuplicatedParameters(methodMeta: MethodMetaInterface): boolean

export const plugin: FastifyPluginAsync<PlatformaticClientPluginOptions>
export default plugin

/**
 * All the errors thrown by the plugin.
 */
export module errors {
  export const OptionsUrlRequiredError: () => FastifyError
}

