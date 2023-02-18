import { Entity } from '@platformatic/sql-mapper';
import graphqlPlugin from '@platformatic/sql-graphql'
import { Movie } from './types/Movie'

declare module 'fastify' {
  interface FastifyInstance {
    getSchema(schemaId: 'Movie'): {
      '$id': string,
      title: string,
      description: string,
      type: string,
      properties: object,
      required: string[]
    };
  }
}

declare module '@platformatic/sql-mapper' {
  interface Entities {
    movie: Entity<Movie>,
  }
}
