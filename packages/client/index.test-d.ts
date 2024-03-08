import { expectError, expectType } from 'tsd'
import fastify, { HTTPMethods } from 'fastify'
import pltClient, { type PlatformaticClientPluginOptions, type GetHeadersOptions, buildOpenAPIClient, errors, InformationalStatus, ClientErrorStatus, RedirectionStatus, ServerErrorStatus, SuccessfulStatus } from '.'
import { FastifyError } from '@fastify/error'

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
  getHeaders: async ({ url }, { sent }, options) => ({ foo: 'bar', url, baz: sent.toString(), opt: JSON.stringify(options) }),
  headers: { foo: 'bar' },
  name: 'Frassica',
  path: 'Fracchia',
  serviceId: 'Fantozzi'
})

const key = Symbol.for('plt.operationIdMap')
type MyType = {
  getFoo: Function
} & Record<typeof key, { path: string, method: HTTPMethods }>

const openTelemetry = {}
const client = await buildOpenAPIClient<MyType>({
  url: 'http://foo.bar',
  path: 'foobar',
  fullRequest: true,
  fullResponse: false,
  throwOnError: false,
  validateResponse: false,
  headers: { foo: 'bar' },
  getHeaders: async (options: GetHeadersOptions) => {
    const { url } = options;
    return { href: url.href };
  },
  queryParser: (query) => `${query.toString()}[]`
}, openTelemetry)

// All params and generic passed
expectType<MyType>(client)
expectType<Function>(client.getFoo)
expectType<{ path: string, method: HTTPMethods }>(client[key])

// Only required params and no generics
expectType<Promise<unknown>>(buildOpenAPIClient({
  url: 'https://undici.com/piscina',
  fullRequest: true,
  fullResponse: false,
  throwOnError: false
}))

expectType<() => FastifyError>(errors.OptionsUrlRequiredError)

expectError<InformationalStatus>(99)
expectType<InformationalStatus>(100)
expectType<InformationalStatus>(150)
expectType<InformationalStatus>(199)
expectError<InformationalStatus>(200)

expectError<SuccessfulStatus>(199)
expectType<SuccessfulStatus>(200)
expectType<SuccessfulStatus>(250)
expectType<SuccessfulStatus>(299)
expectError<SuccessfulStatus>(300)

expectError<RedirectionStatus>(299)
expectType<RedirectionStatus>(300)
expectType<RedirectionStatus>(350)
expectType<RedirectionStatus>(399)
expectError<RedirectionStatus>(400)

expectError<ClientErrorStatus>(399)
expectType<ClientErrorStatus>(400)
expectType<ClientErrorStatus>(450)
expectType<ClientErrorStatus>(499)
expectError<ClientErrorStatus>(500)

expectError<ServerErrorStatus>(499)
expectType<ServerErrorStatus>(500)
expectType<ServerErrorStatus>(550)
expectType<ServerErrorStatus>(599)
expectError<ServerErrorStatus>(600)
