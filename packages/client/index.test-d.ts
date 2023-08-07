import { expectError } from 'tsd' 
import fastify from 'fastify'
import pltClient, { type PltClientOptions } from '.'

const server = await fastify()

expectError<PltClientOptions>({})

expectError<PltClientOptions>({
  fullResponse: true,
  throwOnError: true,
  url: 'localhost'
})

expectError<PltClientOptions>({
  fullResponse: true,
  throwOnError: true,
  type: 'WRONG',
  url: 'localhost'
})

server.register(pltClient, {
  fullResponse: true,
  throwOnError: true,
  type: 'graphql' as const,
  url: 'localhost'
})

const check2 = server.register(pltClient, {
  fullResponse: false,
  throwOnError: false,
  type: 'openapi',
  url: 'http://127.0.0.1/path/42',
  getHeaders: () => console.log('hey!'),
  headers: { foo: 'bar' },
  name: 'Frassica',
  path: 'Fracchia',
  serviceId: 'Fantozzi'
})
