# Mutations

When the GraphQL plugin is loaded, some mutations are automatically adding to
the GraphQL schema.

## `save[ENTITY]`

Saves a new entity to the database or updates an existing entity.

### Example
<!-- docs/sql-graphql/examples/saveEntity.js -->
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
          savePage(input: { id: 3 title: "Platformatic is cool!" }) {
            id
            title
          }
        }
      `
    }
  })
  const result = await res.json()
  console.log(result.data) // { savePage: { id: '3', title: 'Platformatic is cool!' } }
  await app.close()
}

main()
```

## `insert[ENTITY]`

Inserts a new entity in the database.

### Example
<!-- docs/sql-graphql/examples/insertEntity.js -->

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
          savePage(input: { title: "Platformatic is cool!" }) {
            id
            title
          }
        }
      `
    }
  })
  const result = await res.json()
  console.log(result.data) // { savePage: { id: '4', title: 'Platformatic is cool!' } }
  await app.close()
}

main()
```

## `delete[ENTITIES]`

Deletes one or more entities from the database, based on the `where` clause
passed as an input to the mutation.

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
