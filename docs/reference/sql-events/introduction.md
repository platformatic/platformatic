# Introduction to the sql-events module

The Platformatic DB sql-events uses [mqemitter](http://npm.im/mqemitter) to publish events when [entities](/reference/sql-mapper/entities/introduction.md) are saved and deleted.

These events are useful to distribute updates to clients, e.g. via WebSocket, Server-Sent Events, or GraphQL Subscritions.
When subscribing and using a multi-process system with a broker like Redis, a subscribed topic will receive the data from all
the other processes.

They are not the right choice for executing some code whenever an entity is created, modified or deleted, in that case
use [@platformatic/sql-mapper hooks](/reference/sql-mapper/entities/hooks.md).

## Install

You can use together with `@platformatic/sql-mapper`.

```
npm i @platformatic/sql-mapper @platformatic/sql-events
```

## Usage

```javascript
const { connect } = require('@platformatic/sql-mapper')
const { setupEmitter } = require('@platformatic/sql-events')
const { pino } = require('pino')

const log = pino()

async function onDatabaseLoad (db, sql) {
  await db.query(sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL
  );`)
}
const connectionString = 'postgres://postgres:postgres@localhost:5432/postgres'
const mapper = await connect({
  connectionString,
  log,
  onDatabaseLoad,
  ignore: {},
  hooks: {
    Page: {
      find: async function(_find, opts) {
        console.log('hook called');
        return await _find(opts)
      }
    }
  }
})

setupEmitter({ mapper, log })

const pageEntity = mapper.entities.page

const queue = await mapper.subscribe([
  pageEntity.getSubscriptionTopic({ action: 'save' }),
  pageEntity.getSubscriptionTopic({ action: 'delete' })
])

const page = await pageEntity.save({
  input: { title: 'fourth page' }
})

const page2 = await pageEntity.save({
  input: {
    id: page.id,
    title: 'fifth page'
  }
})

await pageEntity.delete({
  where: {
    id: {
      eq: page.id
    }
  },
  fields: ['id', 'title']
})

for await (const ev of queue) {
  console.log(ev)
  if (expected.length === 0) {
    break
  }
}

process.exit(0)
```

### API

The `setupEmitter` function has the following options:

* `mq` - an instance of [`mqemitter`](https://npm.im/mqemitter), optional.

The `setupEmitter` functions adds the following properties to the `mapper` object:

- `mq` — an instance of [`mqemitter`](https://npm.im/mqemitter)
- `subscribe(topics)` — a method to create a node [`Readable`](https://nodejs.org/api/stream.html#new-streamreadableoptions)
  that will contain the events emitted by those topics.

Each entities of `app.platformatic.entities` will be augmented with two functions:

* `entity.getPublishTopic({ ctx, data, action })` 
* `entity.getSubscriptionTopic({ ctx, action })`

Where `ctx` is the GraphQL Context, `data` is the object that will be emitted and `action` is either `save` or `delete`.
