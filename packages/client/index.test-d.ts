import { expectType, expectError } from 'tsd' 
import fastify from 'fastify'
import pltClient, { type PltClientOptions } from '.'

const server = await fastify()

const emptyOptions = {} as const

const missingOptions = {
  fullResponse: true,
  throwOnError: true,
  url: 'localhost'
} as const

const wrongOptions = {
  fullResponse: true,
  throwOnError: true,
  type: 'WRONG',
  url: 'localhost'
} as const

const basicOptions = {
  fullResponse: true,
  throwOnError: true,
  type: 'graphql',
  url: 'localhost'
} as const

const allOptions = {
  fullResponse: false,
  throwOnError: false,
  type: 'openapi',
  url: 'http://127.0.0.1/path/42',
  getHeaders: () => console.log('hey!'),
  headers: { foo: 'bar' },
  name: 'Frassica',
  path: 'Fracchia',
  serviceId: 'Fantozzi'
} as const


expectType<PltClientOptions>(basicOptions)
expectType<PltClientOptions>(allOptions)

expectError<PltClientOptions>(emptyOptions)
expectError<PltClientOptions>(wrongOptions)
expectError<PltClientOptions>(missingOptions)

server.register(pltClient, basicOptions)
server.register(pltClient, allOptions)
