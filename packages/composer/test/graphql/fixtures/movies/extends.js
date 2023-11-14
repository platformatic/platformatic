'use strict'

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
  app.graphql.extendSchema(`
    type Artist {
      id: ID
      movies: [Movie]
    }

    extend type Movie {
      director: Artist
    }

    extend type Query {
      movieArtists (ids: [ID!]!): [Artist]
    }
  `)
  app.graphql.defineResolvers({
    Movie: {
      director: (parent, args, context, info) => {
        return parent?.directorId ? { id: parent.directorId } : null
      }
    },
    Artist: {
      // TODO dataloader here
      movies: async (parent, args, context, info) => {
        const movies = await app.platformatic.entities.movie.find({
          where: { directorId: { eq: parent.id } },
          fields: selectionFields(info, 'movies'),
          ctx: null
        })
        return movies
      }
    },
    Query: {
      movieArtists: async (parent, args, context, info) => {
        return args.ids.map(id => ({ id }))
      }
    }
  })
}
