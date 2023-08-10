# Raw SQL queries

To run raw SQL queries using plugins, use `app.platformatic.db.query` method and passe to it a sql query using the `app.platformatic.sql` method.

```js
'use strict'
module.exports = async(app, opts) => {
  app.graphql.extendSchema(`
    type YearlySales {
      year: Int
      sales: Int
    }

    extend type Query {
      yearlySales: [YearlySales]
    }
  `)
  app.graphql.defineResolvers({
    Query: {
      yearlySales: async(_, { title }) => {
        const {sql} = app.platformatic;
        const res = await app.platformatic.db.query(sql(`
          SELECT
            YEAR(created_at) AS year,
            SUM(amount) AS sales
          FROM
            orders
          GROUP BY
            YEAR(created_at)
        `))
        return res
      }
    }
  })
}
```
