# Queries

A GraphQL query is automatically added to the GraphQL schema for each database
table, along with a complete mapping for all table fields.

## Example

<!-- ./docs/sql-graphql/examples/query.js -->
```js
'use strict'

const Fastify = require('fastify')
const graphqlPlugin = require('@platformatic/sql-graphql')
const sqlMapper = require('@platformatic/sql-mapper')
async function main() {
  const app = Fastify({
    logger: {
      level: 'info'
    }
  })
  app.register(sqlMapper, {
    connectionString: 'postgres://postgres:postgres@127.0.0.1/postgres'
  })
  app.register(graphqlPlugin, {
    graphiql: true
  })
  const res = await app.inject({
    method: 'POST',
    url: '/graphql',
    body: {
      query: `
        query{
          pages{
            id,
            title
          }
        }
      `
    }
  })
  const result = await res.json()
  console.log(result.data)
  await app.close()
}
main()
```

## Advanced Queries

The following additional queries are added to the GraphQL schema for each entity:

### `get[ENTITY]by[PRIMARY_KEY]`

If you have a table `pages` with the field `id` as the primary key, you can run
a query called `getPageById`.

#### Example

```js
...
const res = await app.inject({
  method: 'POST',
  url: '/graphql',
  body: {
    query: `
      query{
        getPageById(id: 3) {
          id,
          title
        }
      }
    `
  }
})
const result = await res.json()
console.log(result.data) // { getPageById: { id: '3', title: 'A fiction' } }
```

### `count[ENTITIES]`

```js
...
const res = await app.inject({
  method: 'POST',
  url: '/graphql',
  body: {
    query: `
      query {
        countPages {
          total
        }
      }
    `
  }
})
const result = await res.json()
console.log(result.data) // { countMovies : { total: { 17 } }
```

## Pagination

The Platformatic DB supports for result's pagination through input parameters: `limit` and `offset`

_Example_

```js
{
  users(limit:5, offset: 10) {
    name
  }
}
```

It returns 5 users starting from position 10.

### Limit

By default a *limit* value (`10`) is applied to each request.

Clients can override this behavior by passing a value.
In this case the server validates the input and an error is return if exceeds the `max` accepted value (`100`).

Limit's values can be customized through configuration:

```json
{
  ...
  "core": {
    ...
    "limit": {
      "default": 50,
      "max": 1000
    }
  }
}
```

*Limit* only accepts values `>= 0`. Otherwise the default behavior is applied.


### Offset

By default *offset* is not applied to the request.
Clients can override this behavior by passing a value.

*Offset* only accepts values `>= 0`. Otherwise the default behavior is applied.
