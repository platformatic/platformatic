// import { expectType } from 'tsd'
import { fastify, FastifyInstance } from 'fastify'
import plugin, { SQLEventsPluginOptions } from '../../index'

const pluginOptions: SQLEventsPluginOptions = {
}

const instance: FastifyInstance = fastify()
instance.register(plugin, pluginOptions)
/*
instance.register(async (instance) => {
  expectType<MercuriusPlugin>(instance.graphql)
})
*/
