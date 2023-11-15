'use strict'

const { Factory } = require('single-user-cache')
const cache = new Factory()

// TODO move to utility, export
// TODO check fragments, alias
function selectionFields (info, name) {
  let nodes = info.fieldNodes
  let node
  while (nodes) {
    node = nodes.find(node => node.name.value === name)
    if (node) {
      return node.selectionSet.selections.map(selection => selection.name.value)
    }
    nodes = nodes.map(n => n.selectionSet.selections).flat()
  }
}

module.exports = async (app, opts) => {
  // TODO move to utility, export
  cache.add('movies', { cache: true },
    async (queries, context) => {
      const ids = new Set()
      const fields = new Set(['directorId'])
      for (let i = 0; i < queries.length; i++) {
        ids.add(queries[i].directorId)
        for (let j = 0; j < queries[i].fields.length; j++) {
          fields.add(queries[i].fields[j])
        }
      }

      // TODO remove limit
      const movies = await app.platformatic.entities.movie.find({
        where: { directorId: { in: Array.from(ids) } },
        fields: Array.from(fields),
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
        const fields = selectionFields(info, 'movies')
        return (await loader.movies({ directorId: String(parent.id), fields })) ?? []
      }
    },
    Query: {
      movieArtists: async (parent, args, context, info) => {
        return args.ids.map(id => ({ id }))
      }
    }
  })
}
