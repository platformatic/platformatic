# Mutations

When the GraphQL plugin is loaded, some mutations are automatically adding to
the GraphQL schema.

## `insert[ENTITY]`

Inserts one new entity and returns it.

```graphql
mutation {
  insertPage(input: { title: "Platformatic is cool!" }) {
    id
    title
  }
}
```

When an entity has the same singular and plural name (for example, `sheep`), the singular mutation is named `insertOne[ENTITY]` (such as `insertOneSheep`) so the existing bulk `insert[ENTITIES]` name remains available.

## `insert[ENTITIES]`

Inserts multiple entities and returns them as a list.

```graphql
mutation {
  insertPages(inputs: [{ title: "First" }, { title: "Second" }]) {
    id
    title
  }
}
```

## `update[ENTITY]`

Updates the entity identified by all fields in its primary key. It returns `null` when the row does not exist and never inserts a row.

```graphql
mutation {
  updatePage(input: { id: 3, title: "Updated" }) {
    id
    title
  }
}
```

## `upsert[ENTITY]`

Updates an entity when all primary keys are provided and the row exists; otherwise inserts it. This preserves the SQL mapper's update-then-insert behavior and is not a database-native atomic upsert.

```graphql
mutation {
  upsertPage(input: { id: 3, title: "Platformatic is cool!" }) {
    id
    title
  }
}
```

## `save[ENTITY]` (deprecated)

`save[ENTITY]` remains as a deprecated compatibility alias for `upsert[ENTITY]`.

## `delete[ENTITIES]`

Deletes one or more entities from the database, based on the `where` clause
passed as an input to the mutation. All the rows matching the clause are
deleted in a single mutation and returned in the response, e.g.:

```graphql
mutation {
  deletePages(where: { status: { eq: "draft" } }) {
    id
    title
  }
}
```

deletes every draft page and returns them.

### Example

<!-- docs/sql-graphql/examples/deleteEntity.js -->

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
    connectionString: 'postgres://postgres:postgres@127.0.0.1/postgres',
    log: logger,
  })
  app.register(graphqlPlugin, {
    graphiql: true
  })
  const res = await app.inject({
    method: 'POST',
    url: '/graphql',
    body: {
      query: `
        mutation {
          deletePages(where: { id: { eq: "3" } }) {
            id
            title
          }
        }
      `
    }
  })
  const result = await res.json()
  console.log(result.data) // { deletePages: [ { id: '3', title: 'Platformatic is cool!' } ] }
  await app.close()
}

main()
```
