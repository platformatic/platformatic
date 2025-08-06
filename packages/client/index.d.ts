import { FastifyError } from '@fastify/error'
import { Dispatcher } from 'undici';

type CodeClasses = 1 | 2 | 3 | 4 | 5;
type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type StringAsNumber<T extends string> = T extends `${infer N extends number}` ? N : never;
type StatusCodes<T extends CodeClasses> = StringAsNumber<`${T}${Digit}${Digit}`>;
export type StatusCode1xx = StatusCodes<1>;
export type StatusCode2xx = StatusCodes<2>;
export type StatusCode3xx = StatusCodes<3>;
export type StatusCode4xx = StatusCodes<4>;
export type StatusCode5xx = StatusCodes<5>;

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
  fullResponse?: boolean;
  fullRequest?: boolean;
  throwOnError?: boolean;
  headers?: Headers;
  bodyTimeout?: number;
  headersTimeout?: number;
  validateResponse?: boolean;
  queryParser?: (query: URLSearchParams) => string;
  dispatcher?: Dispatcher;
}

type BuildOpenAPIClientOptions  = PlatformaticClientOptions & {
  getHeaders?: (options: GetHeadersOptions) => Promise<Headers>;
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

export module errors {
  export const OptionsUrlRequiredError: () => FastifyError
  export const FormDataRequiredError: (value: string) => FastifyError
  export const MissingParamsRequiredError: (value: string) => FastifyError
  export const WrongOptsTypeError: () => FastifyError
  export const InvalidResponseSchemaError: (value: string) => FastifyError
  export const InvalidContentTypeError: (value: string) => FastifyError
  export const InvalidResponseFormatError: () => FastifyError
  export const UnexpectedCallFailureError: (value: string) => FastifyError
}

