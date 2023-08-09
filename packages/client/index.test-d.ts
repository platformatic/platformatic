import { expectError } from 'tsd' 
import fastify from 'fastify'
import pltClient, { type PlatformaticClientPluginOptions } from '.'

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

const check2 = server.register(pltClient, {
  fullResponse: false,
  throwOnError: false,
  type: 'openapi',
  url: 'http://127.0.0.1/path/42',
  getHeaders: () => { 
    return { foo: 'bar' }
  },
  headers: { foo: 'bar' },
  name: 'Frassica',
  path: 'Fracchia',
  serviceId: 'Fantozzi'
})
