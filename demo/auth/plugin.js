'use strict'

module.exports = async function app (app) {
  app.log.info('loaded')

  app.get('/hello', async function () {
    return {
      message: 'Hello World!'
    }
  })

  // console.log(await app.platformatic.entities.page.find({ fields: ['title'] }))

  app.graphql.extendSchema(`
    extend type Query {
      hello: String,
      titles: [String]
    }
  `)
  app.graphql.defineResolvers({
    Query: {
      hello: () => 'Hello World!',
      titles: async () => {
        const { db, sql } = app.platformatic

        const titles = await db.query(sql`
          SELECT title FROM pages
        `)

        return titles.map(({ title }) => title)
      }
    }
  })
}
