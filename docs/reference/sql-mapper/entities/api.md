# API

A set of operation methods are available on each entity:

- [`find`](#find)
- [`count`](#count)
- [`insert`](#insert)
- [`save`](#save)
- [`delete`](#delete)
- [`updateMany`](#updatemany)


## Returned fields

The entity operation methods accept a `fields` option that can specify an array of field names to be returned. If not specified, all fields will be returned.

## Where clause

The entity operation methods accept a `where` option to allow limiting of the database rows that will be affected by the operation.

The `where` object's key is the field you want to check, the value is a key/value map where the key is an operator (see the table below) and the value is the value you want to run the operator against.

| Platformatic operator | SQL operator |
|--- | ---|
| eq | `'='` |
| in | `'IN'` |
| nin | `'NOT IN'` |
| neq | `'<>'` |
| gt | `'>'` |
| gte | `'>='` |
| lt | `'<'` |
| lte | `'<='` |
| like | `'LIKE'` |

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

Insert one or more entity rows in the database.

#### Options

| Name | Type | Description
|---|---|---|
| `fields` | Array of `string` | List of fields to be returned for each object |
| `inputs` | Array of `Object` | Each object is a new row

#### Usage
<!-- docs/reference/sql-mapper/examples/insert.js -->
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
  const res = await mapper.entities.page.insert({
    fields: ['id', 'title' ],
      inputs: [
        { title: 'Foobar' },
        { title: 'FizzBuzz' }
      ],
  })
  logger.info(res)
  /**
    0: {
      "id": "16",
      "title": "Foobar"
    }
    1: {
      "id": "17",
      "title": "FizzBuzz"
    }
  */
  await mapper.db.dispose()
}
main()
```

### `save`

Create a new entity row in the database or update an existing one.

To update an existing entity, the `id` field (or equivalent primary key) must be included in the `input` object. 
`save` actually behaves as an `upsert`, allowing both behaviours depending on the presence of the primary key field.

#### Options

| Name | Type | Description
|---|---|---|
| `fields` | Array of `string` | List of fields to be returned for each object |
| `input` | `Object` | The single row to create/update

#### Usage
<!-- docs/reference/sql-mapper/examples/save.js -->
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
  const res = await mapper.entities.page.save({
    fields: ['id', 'title' ],
      input: { id: 1, title: 'FizzBuzz' },
  })
  logger.info(res)
  await mapper.db.dispose()
}
main()
```
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
