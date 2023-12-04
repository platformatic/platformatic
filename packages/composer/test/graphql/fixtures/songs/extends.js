'use strict'

const { Factory } = require('single-user-cache')
const cache = new Factory()

const QUERY_RESULT_LIMIT = 100

module.exports = async (app, opts) => {
  cache.add('songs', { cache: false },
    async (queries, context) => {
      const ids = new Set()
      // TODO fixed fields + info const fields = new Set(['singerId'])
      for (let i = 0; i < queries.length; i++) {
        queries[i].singerId = String(queries[i].singerId)
        ids.add(queries[i].singerId)
      }

      const songs = await app.platformatic.entities.song.find({
        where: { singerId: { in: Array.from(ids) } },
        limit: QUERY_RESULT_LIMIT,
        ctx: null
      })

      const results = new Map(queries.map(q => [String(q.singerId), []]))
      for (let i = 0; i < songs.length; i++) {
        songs[i].id = String(songs[i].id)
        results.get(String(songs[i].singerId)).push(songs[i])
      }

      return Array.from(results.values())
    }) // TODO custom serializer

  const loader = cache.create()

  app.graphql.extendSchema(`
    type Artist {
      id: ID
      songs: [Song]
    }

    extend type Song {
      singer: Artist
    }

    extend type Query {
      getArtistsBySongs (ids: [ID!]!): [Artist]
      getSongsByArtists (ids: [ID!]!): [Song]
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
        const r = await loader.songs({ singerId: parent.id })
        return r ?? []
      }
    },
    Query: {
      getArtistsBySongs: async (parent, { ids }, context, info) => {
        return ids.map(id => ({ id }))
      },
      getSongsByArtists: async (parent, args, context, info) => {
        const songs = await app.platformatic.entities.song.find({
          where: { singerId: { in: args.ids } },
          limit: QUERY_RESULT_LIMIT,
          ctx: null
        })

        return songs.map(s => ({ ...s, singerId: s.singerId }))
      }
    }
  })
}
