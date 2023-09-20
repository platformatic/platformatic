import { FastifyPluginAsync } from 'fastify'
import { GraphQLScalarType } from 'graphql'
import { IResolverObject, IResolverOptions, MercuriusContext } from 'mercurius'
import { FastifyError } from '@fastify/error'

type IEnumResolver = {
  [key: string]: string | number | boolean
}

export interface IResolvers<TSource = any, TContext = MercuriusContext> {
  [key: string]:
  | (() => any)
  | IResolverObject<TSource, TContext>
  | IResolverOptions<TSource, TContext>
  | GraphQLScalarType
  | IEnumResolver
  | undefined
}

export interface SQLGraphQLPluginOptions {
  /**
   * If true, serves GraphiQL on /graphiql.
   */
  graphiql?: boolean,
  /**
   * Parameter that enables federation metadata support.
   */
  federationMetadata?: boolean,
  /**
 * Object with graphql resolver functions.
 */
  resolvers?: IResolvers,
  /*
   * The graphql schema.
   */
  schema?: string,
}

declare const plugin: FastifyPluginAsync<SQLGraphQLPluginOptions>
export default plugin

/**
 * All the errors thrown by the plugin.
 */
export module errors {
  export const UnableToGenerateGraphQLEnumTypeError: () => FastifyError
  export const UnsupportedKindError: (kind: string) => FastifyError
  export const ErrorPrintingGraphQLSchema: () => FastifyError
}

