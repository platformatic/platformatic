import { expectError, expectType } from 'tsd'
import fastify from 'fastify'
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

const openTelemetryClient = {}
expectType<Promise<MyType>>(buildOpenAPIClient<MyType>({
  url: 'http://foo.bar',
  path: 'foobar'
}, openTelemetryClient))

expectType<() => FastifyError>(errors.OptionsUrlRequiredError)

