/// <reference path="./global.d.ts" />

import { expectType } from 'tsd'
import { AggregateRating } from './types/AggregateRating'
import { Movie } from './types/Movie'
import { FastifyInstance, fastify } from 'fastify'

const app: FastifyInstance = fastify()

const aggregateRatings = await app.platformatic.entities.aggregateRating.find()
expectType<Partial<AggregateRating>[]>(aggregateRatings)

const aggregateRating = aggregateRatings[0] as AggregateRating
expectType<{
	id?: number;
	movieId: number;
	rating: number;
	ratingType: string;
}>(aggregateRating)


const movies = await app.platformatic.entities.movie.find()
expectType<Partial<Movie>[]>(movies)

const movie = movies[0] as Movie
expectType<{
	id?: number;
	title: string;
	boxOffice?: number | null;
	year: number;
}>(movie)
