import { expectError, expectType } from 'tsd'
import fastify, { HTTPMethods } from 'fastify'
import pltClient, { type PlatformaticClientPluginOptions, buildOpenAPIClient, errors } from '.'
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

const key = Symbol.for('operationIdMap')
type MyType = {
  getFoo: Function
} & Record<typeof key, { path: string, method: string }>

const openTelemetry = {}
const client = await buildOpenAPIClient<MyType>({
  url: 'http://foo.bar',
  path: 'foobar',
  fullRequest: true,
  fullResponse: false,
  throwOnError: false,
  validateResponse: false,
  headers: { foo: 'bar' }
}, openTelemetry)

// All params and generic passed
expectType<MyType>(client)
expectType<Function>(client.getFoo)
expectType<{ path: string, method: string }>(client[key])

// Only required params and no generics
expectType<Promise<unknown>>(buildOpenAPIClient({
  url: 'https://undici.com/piscina',
  fullRequest: true,
  fullResponse: false,
  throwOnError: false
}))

expectType<() => FastifyError>(errors.OptionsUrlRequiredError)

