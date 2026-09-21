import type { Readable } from 'node:stream'
import { connect, type Entities, type SQLMapperPluginInterface } from '@platformatic/sql-mapper'
import fastify from 'fastify'
import MQEmitter from 'mqemitter'
import { expect, test } from 'tstyche'
import plugin, { setupEmitter, type SQLEventsPluginInterface, type SQLEventsPluginOptions } from '../../index.js'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: SQLMapperPluginInterface<Entities> & SQLEventsPluginInterface
  }
}
const pluginOptions: SQLEventsPluginOptions<Entities> = {}

test('plugin', () => {
  const instance = fastify()

  instance.register(plugin)
  instance.register(plugin, pluginOptions)

  instance.register(async (instance) => {
    expect(instance.platformatic.subscribe('/entity/page/save/+')).type.toBe<Promise<Readable>>()
    expect(instance.platformatic.subscribe(['/entity/page/save/+', '/entity/page/delete/+'])).type.toBe<Promise<Readable>>()
  })
})

test('setupEmitter', () => {
  expect(setupEmitter(pluginOptions)).type.toBe<void>()
})

test('SQLOpenApiPluginOptions', async () => {
  expect<SQLEventsPluginOptions<Entities>>().type.toBeAssignableFrom({})

  expect<SQLEventsPluginOptions<Entities>>().type.toBeAssignableFrom({
    connectionString: 'mysql://root@127.0.0.1:3307/graph'
  })

  const mapper = await connect({ connectionString: 'sqlite://:memory:' })
  expect<SQLEventsPluginOptions<Entities>>().type.toBeAssignableFrom({ mapper })

  const mq = MQEmitter()
  expect<SQLEventsPluginOptions<Entities>>().type.toBeAssignableFrom({ mq })
})
