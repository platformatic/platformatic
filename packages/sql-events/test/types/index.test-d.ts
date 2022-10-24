import { expectType } from 'tsd'
import { fastify, FastifyInstance } from 'fastify'
import plugin, { setupEmitter } from '../../index'
import { Readable } from 'stream'
import {SQLMapperPluginInterface} from '@platformatic/sql-mapper'

const instance: FastifyInstance = fastify()
instance.register(plugin)

instance.register(async (instance) => {
  expectType<Promise<Readable>>(instance.platformatic.subscribe('/test'))
  expectType<Promise<Readable>>(instance.platformatic.subscribe(['/test']))
})

setupEmitter({ mapper: {} as SQLMapperPluginInterface })
