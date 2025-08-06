import { FastifyError } from '@fastify/error'
import fastify from 'fastify'
import { expectAssignable, expectError, expectNotAssignable, expectType } from 'tsd'
import { Agent } from 'undici'
import {
  buildOpenAPIClient,
  errors,
  type GetHeadersOptions,
  type StatusCode1xx,
  type StatusCode2xx,
  type StatusCode3xx,
  type StatusCode4xx,
  type StatusCode5xx
} from '.'
import pltClient, { type PlatformaticClientPluginOptions } from './lib/fastify-plugin.js'

const server = await fastify()

expectError<PlatformaticClientPluginOptions>({})

expectError<PlatformaticClientPluginOptions>({
  fullRequest: true,
  fullResponse: true,
  throwOnError: true,
  url: 'localhost'
})

expectError<PlatformaticClientPluginOptions>({
  fullRequest: true,
  fullResponse: true,
  throwOnError: true,
  type: 'WRONG',
  url: 'localhost'
})

server.register(pltClient, {
  fullRequest: true,
  fullResponse: true,
  throwOnError: true,
  type: 'graphql',
  url: 'localhost'
})

server.register(pltClient, {
  fullRequest: false,
  fullResponse: false,
  validateResponse: false,
  throwOnError: false,
  type: 'openapi',
  url: 'http://127.0.0.1/path/42',
  getHeaders: async ({ url }, { sent }, options) => ({
    foo: 'bar',
    url,
    baz: sent.toString(),
    opt: JSON.stringify(options)
  }),
  headers: { foo: 'bar' },
  name: 'Frassica',
  path: 'Fracchia',
  serviceId: 'Fantozzi'
})

const key = Symbol.for('plt.operationIdMap')
type MyType = {
  getFoo: Function
} & Record<typeof key, { path: string; method: string }>

const dispatcher = new Agent({ allowH2: true, connections: 10 })
const openTelemetry = {}
const client = await buildOpenAPIClient<MyType>(
  {
    url: 'http://foo.bar',
    path: 'foobar',
    fullRequest: true,
    fullResponse: false,
    throwOnError: false,
    validateResponse: false,
    headers: { foo: 'bar' },
    bodyTimeout: 900000,
    headersTimeout: 900000,
    getHeaders: async (options: GetHeadersOptions) => {
      const { url } = options
      return { href: url.href }
    },
    queryParser: query => `${query.toString()}[]`,
    dispatcher
  },
  openTelemetry
)

const isSuccessfulResponse = (status: number): status is StatusCode2xx => status >= 200 && status <= 299

async function _exampleUsageOfStatusCodeType (status: number) {
  if (isSuccessfulResponse(status)) {
    expectType<StatusCode2xx>(status)
  } else {
    expectError<StatusCode2xx>(status)
  }
}

expectNotAssignable<StatusCode1xx>(99)
expectAssignable<StatusCode1xx>(100)
expectAssignable<StatusCode1xx>(101)
expectAssignable<StatusCode1xx>(150)
expectAssignable<StatusCode1xx>(199)
expectNotAssignable<StatusCode1xx>(200)

expectNotAssignable<StatusCode2xx>(199)
expectAssignable<StatusCode2xx>(200)
expectAssignable<StatusCode2xx>(201)
expectAssignable<StatusCode2xx>(250)
expectAssignable<StatusCode2xx>(299)
expectNotAssignable<StatusCode2xx>(300)

expectNotAssignable<StatusCode3xx>(299)
expectAssignable<StatusCode3xx>(300)
expectAssignable<StatusCode3xx>(301)
expectAssignable<StatusCode3xx>(350)
expectAssignable<StatusCode3xx>(399)
expectNotAssignable<StatusCode3xx>(400)

expectNotAssignable<StatusCode4xx>(399)
expectAssignable<StatusCode4xx>(400)
expectAssignable<StatusCode4xx>(401)
expectAssignable<StatusCode4xx>(450)
expectAssignable<StatusCode4xx>(499)
expectNotAssignable<StatusCode4xx>(500)

expectNotAssignable<StatusCode5xx>(399)
expectAssignable<StatusCode5xx>(500)
expectAssignable<StatusCode5xx>(501)
expectAssignable<StatusCode5xx>(550)
expectAssignable<StatusCode5xx>(599)
expectNotAssignable<StatusCode5xx>(600)

// All params and generic passed
expectType<MyType>(client)
expectType<Function>(client.getFoo)
expectType<{ path: string; method: string }>(client[key])

// Only required params and no generics
expectType<Promise<unknown>>(
  buildOpenAPIClient({
    url: 'https://undici.com/piscina',
    fullRequest: true,
    fullResponse: false,
    throwOnError: false
  })
)

expectType<() => FastifyError>(errors.OptionsUrlRequiredError)
expectType<(_: string) => FastifyError>(errors.FormDataRequiredError)
expectType<(_: string) => FastifyError>(errors.MissingParamsRequiredError)
expectType<() => FastifyError>(errors.WrongOptsTypeError)
expectType<(_: string) => FastifyError>(errors.InvalidResponseSchemaError)
expectType<(_: string) => FastifyError>(errors.InvalidContentTypeError)
expectType<() => FastifyError>(errors.InvalidResponseFormatError)
expectType<(_: string) => FastifyError>(errors.UnexpectedCallFailureError)
