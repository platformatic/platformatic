import { expectType } from 'tsd'
import { fastify, FastifyInstance } from 'fastify'
import { MercuriusPlugin } from 'mercurius'
import plugin, { SQLGraphQLPluginOptions } from '../../index'

const pluginOptions: SQLGraphQLPluginOptions = {
  graphiql: true,
  autoTimestamp: true,
  federationMetadata: true,
  resolvers: {
    Mutation: {
      savePage: false,
      deletePages: false,
      insertPages: false
    },
    Query: {
      async getCategory (root, args, context, info) {
        return { id: 1, name: 'Hello' }
      }
    },
  },
  schema: `
    extend type Query {
      add(a: Int!, b: Int!): Int
    }
  `
}

const instance: FastifyInstance = fastify()
instance.register(plugin, pluginOptions)
instance.register(async (instance) => {
  expectType<MercuriusPlugin>(instance.graphql)
})
