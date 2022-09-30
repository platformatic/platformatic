import { Entity } from '@platformatic/sql-mapper';
import graphqlPlugin from '@platformatic/sql-graphql'
import { Movie } from './types/Movie'

declare module '@platformatic/sql-mapper' {
  interface Entities {
    movie: Entity<Movie>,
  }
}
