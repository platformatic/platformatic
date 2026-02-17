/// <reference types="./plt-env.d.ts" />

import { fastify, type FastifyInstance } from 'fastify'
import { expect } from 'tstyche'
import type { AggregateRating } from './types/aggregateRating.js'
import type { Movie } from './types/movie.js'

const app: FastifyInstance = fastify()

const aggregateRatings = await app.platformatic.entities.aggregateRating.find()
expect(aggregateRatings).type.toBe<Partial<AggregateRating>[]>()

const aggregateRating = aggregateRatings[0] as AggregateRating
expect(aggregateRating).type.toBe<{
  id?: number
  movieId: number
  rating: number
  ratingType: string
}>()

const movies = await app.platformatic.entities.movie.find()
expect(movies).type.toBe<Partial<Movie>[]>()

const movie = movies[0] as Movie
expect(movie).type.toBe<{
  id?: number
  title: string
  boxOffice?: number | null
  year: number
}>()
