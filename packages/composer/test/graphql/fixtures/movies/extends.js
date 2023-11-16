'use strict'

const { Factory } = require('single-user-cache')
const cache = new Factory()

module.exports = async (app, opts) => {
  // TODO move to utility, export
  cache.add('movies', { cache: false },
    async (queries, context) => {
      const ids = new Set()
      for (let i = 0; i < queries.length; i++) {
        ids.add(queries[i].directorId)
      }

      // TODO remove limit
      const movies = await app.platformatic.entities.movie.find({
        where: { directorId: { in: Array.from(ids) } },
        limit: 100,
        ctx: null
      })

      const results = new Map(queries.map(q => [q.directorId, []]))
      for (let i = 0; i < movies.length; i++) {
        results.get(String(movies[i].directorId)).push(movies[i])
      }

      return Array.from(results.values())
    })

  const loader = cache.create()

  app.graphql.extendSchema(`
    type Artist {
      id: ID
      movies: [Movie]!
    }

    extend type Movie {
      director: Artist
    }

    extend type Query {
      movieArtists (ids: [ID!]!): [Artist]!
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
        const r = await loader.movies({ directorId: String(parent.id) })
        return r ?? []
      }
    },
    Query: {
      movieArtists: async (parent, args, context, info) => {
        return args.ids.map(id => ({ id }))
      }
    }
  })
}
