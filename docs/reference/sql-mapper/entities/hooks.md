# Hooks

Entity hooks are a way to wrap the [API methods](./api.md) for an entity and add custom behaviour.

The Platformatic DB SQL Mapper provides an `addEntityHooks(entityName, spec)` function that can be used to add hooks for an entity.

## How to use hooks

`addEntityHooks` accepts two arguments:

1. A string representing the entity name (singularized), for example `'page'`.
1. A key/value object where the key is one of the API methods (`find`, `count`, `insert`, `save`, `update`, `delete`, `updateMany`) and the value is a callback function. The callback will be called with the _original_ API method and the options that were passed to that method. See the example below.

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


## `save`, `update` and `insert` hooks

`save` is an upsert: it runs an `UPDATE` when all the primary keys are present and the row exists, and an `INSERT` otherwise. A `save` hook runs before that decision is taken, so by default it cannot tell a create from an update, and `insert` hooks do not see the rows created through `save`.

Set the `saveDispatch` option of [`connect`](../overview.md) (or `db.saveDispatch` in the Platformatic DB [configuration](../../db/configuration.md)) to `true` to make `save` a dispatcher. It calls `entity.update` when all the primary keys are present and, if no row was updated, `entity.insert`. Their hooks are therefore applied:

| Call | `saveDispatch: false` (default) | `saveDispatch: true` |
|---|---|---|
| `save` without primary keys | `save` | `save` → `insert` |
| `save` with primary keys, row exists | `save` | `save` → `update` |
| `save` with primary keys, row missing | `save` | `save` → `update` (returns `null`) → `insert` |
| `update` | `update` | `update` |
| `insert` | `insert` | `insert` |

`update` hooks run in both modes, but with the default settings they only fire on direct `entity.update` calls.

`update` resolves to `null` when no row matches the primary keys, so `update` hooks must handle it:

```js
mapper.addEntityHooks('page', {
  async update (originalUpdate, opts) {
    const res = await originalUpdate(opts)
    if (res) {
      // the row was updated
    }
    return res
  }
})
```

With `saveDispatch` enabled:

- `insert` hooks also see the rows created through `save`. They are called with `{ inputs: [input], ...opts }`, and only the first element of the returned array is returned by `save`. If you hook both `save` and `insert`, a create through `save` fires both.
- As before, `save` ignores user-provided values for the `autoTimestamp` fields: they are removed from the input passed to `insert`.
- `save` hooks still wrap the whole call, so they run before the `update` and `insert` hooks.
- Plugins such as `@platformatic/db-authorization` and `@platformatic/sql-events` do not register a `save` hook. Their logic lives in the `update` and `insert` hooks. In particular, the authorization `defaults` are applied inside `update` or `insert`, after your `save` hooks have run.

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


