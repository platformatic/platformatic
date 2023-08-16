import { expectError, expectType } from 'tsd' 
import fastify from 'fastify'
import pltClient, { type PlatformaticClientPluginOptions, buildOpenAPIClient} from '.'

const server = await fastify()

expectError<PlatformaticClientPluginOptions>({})

expectError<PlatformaticClientPluginOptions>({
  fullResponse: true,
  throwOnError: true,
  url: 'localhost'
})

expectError<PlatformaticClientPluginOptions>({
  fullResponse: true,
  throwOnError: true,
  type: 'WRONG',
  url: 'localhost'
})

server.register(pltClient, {
  fullResponse: true,
  throwOnError: true,
  type: 'graphql',
  url: 'localhost'
})

server.register(pltClient, {
  fullResponse: false,
  throwOnError: false,
  type: 'openapi',
  url: 'http://127.0.0.1/path/42',
  getHeaders: ({ url }) => ({ foo: 'bar', url }),
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