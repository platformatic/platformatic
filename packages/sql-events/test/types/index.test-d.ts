import { expectType } from 'tsd'
import { fastify, FastifyInstance } from 'fastify'
import plugin, { setupEmitter } from '../../index'
import { Readable } from 'stream'
import { SQLMapperPluginInterface, Entities } from '@platformatic/sql-mapper'
import { SQLEventsPluginInterface } from '../../index'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: SQLMapperPluginInterface<Entities> & SQLEventsPluginInterface
  }
}

const instance: FastifyInstance = fastify()
instance.register(plugin)

instance.register(async (instance) => {
  expectType<Promise<Readable>>(instance.platformatic.subscribe('/test'))
  expectType<Promise<Readable>>(instance.platformatic.subscribe(['/test']))
})

setupEmitter({ mapper: {} as SQLMapperPluginInterface<Entities> })
setupEmitter({ mapper: {} as SQLMapperPluginInterface<Entities>, connectionString: 'redis://localhost:6379' })
setupEmitter({ mapper: {} as SQLMapperPluginInterface<Entities>, mq: {} })
