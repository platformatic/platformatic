# Hooks

Entity hooks are a way to wrap the [API methods](./api) for an entity and add custom behaviour.

The Platformatic DB SQL Mapper provides an `addEntityHooks(entityName, spec)` function that can be used to add hooks for an entity.

## How to use hooks

`addEntityHooks` accepts two arguments:

1. A string representing the entity name (singularized), for example `'page'`.
1. A key/value object where the key is one of the API methods (`find`, `insert`, `save`, `delete`) and the value is a callback function. The callback will be called with the _original_ API method and the options that were passed to that method. See the example below.

### Usage

```js
'use strict'
const { connect } = require('@platformatic/sql-mapper')
const { pino } = require('pino')
const pretty = require('pino-pretty')
const logger = pino(pretty())

async function main() {
  const pgConnectionString = 'postgres://postgres:postgres@127.0.0.1/postgres'
  const mapper = await connect({
    connectionString: pgConnectionString,
    log: logger,
  })
  mapper.addEntityHooks('page', {
    find: async (originalFind, opts) => {
      // Add a `foo` field with `bar` value to each row
      const res = await originalFind(opts)
      return res.map((row) => {
        row.foo = 'bar'
        return row
      })
    }
  })
  const res = await mapper.entities.page.find({
    fields: ['id', 'title',],
    where: {
      id: {
        lt: 10
      }
    },
  })
  logger.info(res)
  /**
  [
    0: {
      "id": "5",
      "title": "Page 1",
      "foo": "bar"
    },
    1: {
      "id": "6",
      "title": "Page 2",
      "foo": "bar"
    }
  ]
  */
  await mapper.db.dispose()
}
main()
```


## Multiple Hooks

Multiple hooks can be added for the same entity and API method, for example:

<!-- docs/reference/sql-mapper/examples/hooks.js -->
```js
'use strict'
const { connect } = require('@platformatic/sql-mapper')
const { pino } = require('pino')
const pretty = require('pino-pretty')
const logger = pino(pretty())

async function main() {
  const pgConnectionString = 'postgres://postgres:postgres@127.0.0.1/postgres'
  const mapper = await connect({
    connectionString: pgConnectionString,
    log: logger,
  })
  mapper.addEntityHooks('page', {
    find: async function firstHook(previousFunction, opts) {
      // Add a `foo` field with `bar` value to each row
      const res = await previousFunction(opts)
      return res.map((row) => {
        row.foo = 'bar'
        return row
      })
    }
  })
  mapper.addEntityHooks('page', {
    find: async function secondHook(previousFunction, opts) {
      // Add a `bar` field with `baz` value to each row
      const res = await previousFunction(opts)
      return res.map((row) => {
        row.bar = 'baz'
        return row
      })
    }
  })
  const res = await mapper.entities.page.find({
    fields: ['id', 'title',],
    where: {
      id: {
        lt: 10
      }
    },
  })
  logger.info(res)
  /**
  [
    0: {
      "id": "5",
      "title": "Page 1",
      "foo": "bar",
      "bar": "baz"
    },
    1: {
      "id": "6",
      "title": "Page 2",
      "foo": "bar",
      "bar": "baz"
    }
  ]
  */
  await mapper.db.dispose()
}
main()
```

Since hooks are wrappers, they are being called in reverse order, like the image below

![Hooks Lifecycle](../images/plt-db-hooks.svg)

So even though we defined two hooks, the Database will be hit only once.

Query result will be processed by `firstHook`, which will pass the result to `secondHook`, which will, finally, send the processed result to the original `.find({...})` function.


