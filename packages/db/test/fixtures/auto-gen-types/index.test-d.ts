/// <reference types="./plt-env.d.ts" />

import { fastify, FastifyInstance } from 'fastify'
import { expectType } from 'tsd'
import { AggregateRating } from './types/aggregateRating'
import { Movie } from './types/movie'

const app: FastifyInstance = fastify()

const aggregateRatings = await app.platformatic.entities.aggregateRating.find()
expectType<Partial<AggregateRating>[]>(aggregateRatings)

const aggregateRating = aggregateRatings[0] as AggregateRating
expectType<{
  id?: number
  movieId: number
  rating: number
  ratingType: string
}>(aggregateRating)

const movies = await app.platformatic.entities.movie.find()
expectType<Partial<Movie>[]>(movies)

const movie = movies[0] as Movie
expectType<{
  id?: number
  title: string
  boxOffice?: number | null
  year: number
}>(movie)
