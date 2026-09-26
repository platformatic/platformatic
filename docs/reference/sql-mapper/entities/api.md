# API

A set of operation methods are available on each entity:

- [`find`](#find)
- [`count`](#count)
- [`insert`](#insert)
- [`insertMany`](#insertmany)
- [`update`](#update)
- [`updateMany`](#updatemany)
- [`upsert`](#upsert)
- [`save`](#save) (deprecated)
- [`delete`](#delete)


## Returned fields

The entity operation methods accept a `fields` option that can specify an array of field names to be returned. If not specified, all fields will be returned.

## Where clause

The entity operation methods accept a `where` option to allow limiting of the database rows that will be affected by the operation.

The `where` object's key is the field you want to check, the value is a key/value map where the key is an operator (see the table below) and the value is the value you want to run the operator against.

| Platformatic operator | SQL operator |
|-----------------------|--------------|
| eq                    | `\'=\'`      |
| in                    | `\'IN\'`     |
| nin                   | `\'NOT IN\'` |
| neq                   | `\'<>\'`     |
| gt                    | `\'>\'`      |
| gte                   | `'\>='`      |
| lt                    | `\'<\'`      |
| lte                   | `\'<=\'`     |
| like                  | `\'LIKE\'`   |
| ilike                 | `\'ILIKE\'`  |
| isNull                | `\'IS NULL\'` (`isNull: false` maps to `IS NOT NULL`) |


### Handling Null Values

When using the `eq` and `neq` operators with a null value, the comparison logic adheres to standard SQL rules for null value handling.

### Examples

#### Selects row with `id = 1`
```
{
  ...
  "where": {
    id: {
      eq: 1
    }
  }
}
```

#### Select all rows with id less than 100
```
{
  ...
  "where": {
    id: {
      lt: 100
    }
  }
}
```

#### Select all rows with id 1, 3, 5 or 7
```
{
  ...
  "where": {
    id: {
      in: [1, 3, 5, 7]
    }
  }
}
```

Where clause operations are by default combined with the `AND` operator. To combine them with the `OR` operator, use the `or` key.

#### Select all rows with id 1 or 3
```
{
  ...
  "where": {
    or: [
      {
        id: {
          eq: 1
        }
      },
      {
        id: {
          eq: 3
        }
      }
    ]
  }
}
```

### Select all rows with id 1 or 3 and title like 'foo%'
```
{
  ...
  "where": {
    or: [
      {
        id: {
          eq: 1
        }
      },
      {
        id: {
          eq: 3
        }
      }
    ],
    title: {
      like: 'foo%'
    }
  }
}
```

### Select all rows where title is null
```
{
  ...
  "where": {
    title: {
      eq: null
    }
  }
}
```

### Select all rows where title is not null
```
{
  ...
  "where": {
    title: {
      neq: null
    }
  }
}
```

## Reference

### `find`

Retrieve data for an entity from the database.

#### Options

| Name | Type | Description
|---|---|---|
| `fields` | Array of `string` | List of fields to be returned for each object |
| `where` | `Object` | [Where clause 🔗](#where-clause)
| `orderBy` | Array of `Object` | Object like `{ field: 'counter', direction: 'ASC' }`
| `limit` | `Number` | Limits the number of returned elements
| `offset` | `Number` | The offset to start looking for rows from


#### Usage
<!-- docs/reference/sql-mapper/examples/find.js -->

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
  const res = await mapper.entities.page.find({
    fields: ['id', 'title',],
    where: {
      id: {
        lt: 10
      }
    },
  })
  logger.info(res)
  await mapper.db.dispose()
}
main()
```

### `count`

Same as `find`, but only count entities. 

#### Options

| Name | Type | Description
|---|---|---|
| `where` | `Object` | [Where clause 🔗](#where-clause)


#### Usage
<!-- docs/reference/sql-mapper/examples/countjs -->

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
  const res = await mapper.entities.page.count({
    where: {
      id: {
        lt: 10
      }
    },
  })
  logger.info(res)
  await mapper.db.dispose()
}
main()
```


### `insert`

Insert one entity row and return the inserted object.

| Name | Type | Description |
|---|---|---|
| `fields` | Array of `string` | Fields to return |
| `input` | `Object` | The row to insert |
| `ctx` | `Object` | Request context used by hooks |
| `tx` | `Object` | Transaction in which to run the query |

```js
const page = await mapper.entities.page.insert({
  input: { title: 'Foobar' },
  fields: ['id', 'title']
})
```

A client-generated primary key may be supplied in `input`. To reject client-provided primary keys in the generated REST API, set `db.openapi.allowPrimaryKeysInInput` to `false`.

### `insertMany`

Insert multiple entity rows and return an array of inserted objects. Passing an empty `inputs` array returns an empty array.

| Name | Type | Description |
|---|---|---|
| `fields` | Array of `string` | Fields to return for each object |
| `inputs` | Array of `Object` | Rows to insert |
| `ctx` | `Object` | Request context used by hooks |
| `tx` | `Object` | Transaction in which to run the query |

```js
const pages = await mapper.entities.page.insertMany({
  inputs: [{ title: 'Foobar' }, { title: 'FizzBuzz' }],
  fields: ['id', 'title']
})
```

### `update`

Update one entity identified by all its primary keys. It never inserts. It returns `null` when the row does not exist and throws `PLT_SQL_MAPPER_MISSING_VALUE_FOR_PRIMARY_KEY` when a primary key is missing.

| Name | Type | Description |
|---|---|---|
| `fields` | Array of `string` | Fields to return |
| `input` | `Object` | Changed fields, including every primary key |
| `ctx` | `Object` | Request context used by hooks |
| `tx` | `Object` | Transaction in which to run the query |

```js
const page = await mapper.entities.page.update({
  input: { id: 1, title: 'Updated' },
  fields: ['id', 'title']
})
```

### `upsert`

Insert a row when its primary keys are absent. When all primary keys are present, try `update` first and fall back to `insert` when no row matches. `upsert` delegates through those public methods, so their hooks run.

```js
const page = await mapper.entities.page.upsert({
  input: { id: 1, title: 'FizzBuzz' }
})
```

This is an update-then-insert operation, not a database-native atomic upsert.

### `save`

> Deprecated: use [`upsert`](#upsert). `save` is a compatibility alias with the same behavior.

### `delete`

Delete one or more entity rows from the database, depending on the `where` option. Returns the data for all deleted objects.

#### Options

| Name | Type | Description
|---|---|---|
| `fields` | Array of `string` | List of fields to be returned for each object |
| `where` | `Object` | [Where clause 🔗](#where-clause)

#### Usage
<!-- docs/reference/sql-mapper/examples/delete.js -->
```js
'use strict'
const { connect } = require('@platformatic/sql-mapper')
const { pino } = require('pino')
const pretty = require('pino-pretty')
const logger = pino(pretty())

async function main() {
  const connectionString = 'postgres://postgres:postgres@127.0.0.1/postgres'
  const mapper = await connect({
    connectionString: connectionString,
    log: logger,
  })
  const res = await mapper.entities.page.delete({
    fields: ['id', 'title',],
    where: {
      id: {
        lt: 4
      }
    },
  })
  logger.info(res)
  await mapper.db.dispose()
}
main()

```

### `updateMany`

Update one or more entity rows from the database, depending on the `where` option. Returns the data for all updated objects.

#### Options

| Name | Type | Description
|---|---|---|
| `where` | `Object` | [Where clause 🔗](#where-clause)
| `input` | `Object` | The new values that want to update
| `fields` | Array of `string` | List of fields to be returned for each object |

#### Usage
<!-- docs/reference/sql-mapper/examples/delete.js -->
```js
'use strict'
const { connect } = require('@platformatic/sql-mapper')
const { pino } = require('pino')
const pretty = require('pino-pretty')
const logger = pino(pretty())

async function main() {
  const connectionString = 'postgres://postgres:postgres@127.0.0.1/postgres'
  const mapper = await connect({
    connectionString: connectionString,
    log: logger,
  })
  const res = await mapper.entities.page.updateMany({
    fields: ['id', 'title',],
    where: {
      counter: {
        gte: 30
      }
    },
    input: { 
      title: 'Updated title'
    }
  })
  logger.info(res)
  await mapper.db.dispose()
}
main()

```
