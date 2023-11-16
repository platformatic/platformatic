'use strict'

const { Factory } = require('single-user-cache')
const cache = new Factory()

module.exports = async (app, opts) => {
  // TODO move to utility, export
  cache.add('songs', { cache: false },
    async (queries, context) => {
      const ids = new Set()
      // TODO fixed fields + info const fields = new Set(['singerId'])
      for (let i = 0; i < queries.length; i++) {
        queries[i].singerId = String(queries[i].singerId)
        ids.add(queries[i].singerId)
      }

      // TODO remove limit
      const songs = await app.platformatic.entities.song.find({
        where: { singerId: { in: Array.from(ids) } },
        // fields: Array.from(fields),
        limit: 100,
        ctx: null
      })

      const results = new Map(queries.map(q => [String(q.singerId), []]))
      for (let i = 0; i < songs.length; i++) {
        results.get(String(songs[i].singerId)).push(songs[i])
      }

      return Array.from(results.values())
    }) // TODO custom serializer

  const loader = cache.create()

  app.graphql.extendSchema(`
    type Artist {
      id: ID
      songs: [Song]!
    }

    extend type Song {
      singer: Artist
    }

    extend type Query {
      songArtists (ids: [ID!]!): [Artist]!
    }
  `)
  app.graphql.defineResolvers({
    Song: {
      singer: (parent, args, context, info) => {
        return parent?.singerId ? { id: parent.singerId } : null
      }
    },
    Artist: {
      songs: async (parent, args, context, info) => {
        const r = await loader.songs({ singerId: String(parent.id) })
        return r ?? []
      }
    },
    Query: {
      songArtists: async (parent, args, context, info) => {
        return args.ids.map(id => ({ id }))
      }
    }
  })
}
