# Extend GraphQL Schema

## Sum Function

Copy and paste this code into `./sample-plugin.js` file

```js
'use strict'
module.exports = async(app, opts) => {
  app.graphql.extendSchema(`
    extend type Query {
      add(x: Int, y: Int): Int
    }
  `)
  app.graphql.defineResolvers({
    Query: {
      add: async (_, { x, y }) => x + y
    }
  })
}
```

This will add a new GraphQL query called `add` which will simply add the two inputs `x` and `y` provided.

You don't need to reload the server, since it will watch this file and hot-reload itself.
Let's query the server with the following body

```graphql

query{
  add(x: 1, y: 2)
}

```
You can use `curl` command to run this query

```
$ curl --location --request POST 'http://localhost:3042/graphql' \
--header 'Content-Type: application/json' \
--data-raw '{"query":"query{\n    add(x: 1, y: 2)\n}"}'
```

You will get this output, with the sum.

```json
{
  "data": {
    "add": 3
  }
}
```

## Extend Entities API

Let's implement a `getPageByTitle` query

```js
'use strict'
module.exports = async(app, opts) => {
  app.graphql.extendSchema(`
    extend type Query {
      getPageByTitle(title: String): Page
    }
  `)
  app.graphql.defineResolvers({
    Query: {
      getPageByTitle: async(_, { title }) => {
        const res = await app.platformatic.entities.page.find({
          where: {
            title: {
              eq: title
            }
          }
        })
        if (res) {
          return res[0]
        }
        return null
      }
    }
  })
}
```

`Page` GraphQL type is already defined by Platformatic DB on start.

We are going to run this code against this GraphQL query

```graphql
query{
    getPageByTitle(title: "First Page"){
        id
        title
    }
}
```

You can use `curl` command to run this query
```
$ curl --location --request POST 'http://localhost:3042/graphql' \
--header 'Content-Type: application/json' \
--data-raw '{"query":"query{\n    getPageByTitle(title: \"First Page\"){\n        id\n        title\n    }\n}"}'
```

You will get an output similar to this

```json
{
    "data": {
        "getPageByTitle": {
            "id": "1",
            "title": "First Page"
        }
    }
}
```

