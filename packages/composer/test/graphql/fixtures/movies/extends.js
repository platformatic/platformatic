'use strict'

const { Factory } = require('single-user-cache')
const cache = new Factory()

const QUERY_RESULT_LIMIT = 100

module.exports = async (app, opts) => {
  cache.add('movies', { cache: false },
    async (queries, context) => {
      const ids = new Set()
      // TODO fixed fields + info const fields = new Set(['directorId'])
      for (let i = 0; i < queries.length; i++) {
        queries[i].directorId = String(queries[i].directorId)
        ids.add(queries[i].directorId)
      }

      const movies = await app.platformatic.entities.movie.find({
        where: { directorId: { in: Array.from(ids) } },
        limit: QUERY_RESULT_LIMIT,
        ctx: null
      })

      const results = new Map(queries.map(q => [String(q.directorId), []]))
      for (let i = 0; i < movies.length; i++) {
        movies[i].id = String(movies[i].id)
        results.get(String(movies[i].directorId)).push(movies[i])
      }

      return Array.from(results.values())
    }) // TODO custom serializer

  const loader = cache.create()

  app.graphql.extendSchema(`
    type Artist {
      id: ID
      movies: [Movie]
    }

    extend type Movie {
      director: Artist
    }

    extend type Query {
      getArtistsByMovies (ids: [ID!]!): [Artist]
      getMoviesByArtists (ids: [ID!]!): [Movie]
    }
  `)
  app.graphql.defineResolvers({
    Movie: {
      director: (parent, args, context, info) => {
        return parent?.directorId ? { id: parent.directorId } : null
      }
    },
    Artist: {
      movies: async (parent, args, context, info) => {
        const r = await loader.movies({ directorId: parent.id })
        return r ?? []
      }
    },
    Query: {
      getArtistsByMovies: async (parent, { ids }, context, info) => {
        return ids.map(id => ({ id }))
      },
      getMoviesByArtists: async (parent, args, context, info) => {
        const movies = await app.platformatic.entities.movie.find({
          where: { directorId: { in: args.ids } },
          limit: QUERY_RESULT_LIMIT,
          ctx: null
        })

        return movies.map(s => ({ ...s, directorId: s.directorId }))
      }
    }
  })
}
