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

type MyType = {
  foo: string
}

// All params and all generics passed
const openTelemetryClient = {}
expectType<Promise<MyType & { operationIdMap: Record<"foo", { path: "/foo"; method: "get"; }>; }>>(buildOpenAPIClient<MyType, Record<"foo", { path: "/foo", method: "get" }>>({
  url: 'http://foo.bar',
  path: 'foobar',
  fullRequest: true,
  fullResponse: false,
  throwOnError: false,
  validateResponse: false,
  headers: { foo: 'bar' }
}, openTelemetryClient))

// Only required params and no generics
expectType<Promise<Record<string, object> & { operationIdMap: Record<string, { path: string; method: HTTPMethods; }>; }>>(buildOpenAPIClient({
  url: 'https://undici.com/piscina',
  fullRequest: true,
  fullResponse: false,
  throwOnError: false
}))

const { operationIdMap } = await buildOpenAPIClient({
  url: 'http://foo.bar',
  fullRequest: false,
  fullResponse: true,
  throwOnError: true
})

expectType<{ path: string; method: HTTPMethods; }>(operationIdMap['getFoo'])

expectType<() => FastifyError>(errors.OptionsUrlRequiredError)

