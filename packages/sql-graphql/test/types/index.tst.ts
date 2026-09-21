import fastify from 'fastify'
import { GraphQLScalarType } from 'graphql'
import type { MercuriusPlugin, MercuriusContext } from 'mercurius'
import { expect, test } from 'tstyche'
import plugin, { type IResolvers, type SQLGraphQLPluginOptions } from '../../index.js'

const pluginOptions: SQLGraphQLPluginOptions = {}

test('plugin', () => {
  const instance = fastify()

  instance.register(plugin)
  instance.register(plugin, pluginOptions)

  instance.register(async (instance) => {
    expect(instance.graphql).type.toBe<MercuriusPlugin>()
  })
})

test('SQLOpenApiPluginOptions', async () => {
  expect<SQLGraphQLPluginOptions>().type.toBeAssignableFrom({})

  expect<SQLGraphQLPluginOptions>().type.toBeAssignableFrom({ graphiql: true })
  expect<SQLGraphQLPluginOptions>().type.toBeAssignableFrom({ federationMetadata: true })

  const schema = `
    extend type Query {
      add(a: Int, b: Int): Int
    }
  `
  expect<SQLGraphQLPluginOptions>().type.toBeAssignableFrom({ schema })

  const resolvers: IResolvers = {
    add: async ({ x, y }) => x + y,

    Query: {
      async getCategory (root, args, context, info) {
        expect(root).type.toBe<any>()
        expect(args).type.toBe<any>()
        expect(context).type.toBe<MercuriusContext>()

        return { id: 1, name: 'Hello' }
      },
    },

    Mutation: {
      createUser: {
        resolve: (root, args, context, info) => {
          expect(root).type.toBe<any>()
          expect(args).type.toBe<any>()
          expect(context).type.toBe<MercuriusContext>()

          return { id: '2', name: 'Jane' }
        },
        fragment: `
          fragment UserFields on User {
            id
            name
          }
        `,
        subscribe: (root, args, context, info) => {
          expect(root).type.toBe<any>()
          expect(args).type.toBe<any>()
          expect(context).type.toBe<MercuriusContext>()

          return null
        },
      },
    },

    Date: new GraphQLScalarType({
      name: 'Date',
      description: 'Date custom scalar type',
      parseValue (value) {
        return value
      },
      serialize (value) {
        return value
      }
    })
  }

  expect<SQLGraphQLPluginOptions>().type.toBeAssignableFrom({ resolvers })

  const falseResolvers: IResolvers = {
    Mutation: {
      savePage: false,
      deletePages: false,
      insertPages: false
    },
    Query: {
      pages: false,
      getPageById: false
    }
  }

  expect<SQLGraphQLPluginOptions>().type.toBeAssignableFrom({ resolvers: falseResolvers })
})
