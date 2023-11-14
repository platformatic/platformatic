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
      songs: [Song]
    }

    extend type Song {
      singer: Artist
    }

    extend type Query {
      songArtists (ids: [ID!]!): [Artist]
    }
  `)
  app.graphql.defineResolvers({
    Song: {
      singer: (parent, args, context, info) => {
        return parent?.singerId ? { id: parent.singerId } : null
      }
    },
    Artist: {
      // TODO dataloader here
      songs: async (parent, args, context, info) => {
        const songs = await app.platformatic.entities.song.find({
          where: { singerId: { eq: parent.id } },
          fields: selectionFields(info, 'songs'),
          ctx: null
        })
        return songs
      }
    },
    Query: {
      songArtists: async (parent, args, context, info) => {
        return args.ids.map(id => ({ id }))
      }
    }
  })
}
