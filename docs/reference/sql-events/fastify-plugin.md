# Fastify Plugin

The `@platformatic/sql-events` package exports a [Fastify](https://fastify.io) plugin that can be used out-of the box in a server application.
It requires that `@platformatic/sql-mapper` is registered before it.

The plugin has the following options:

* `mq` - an instance of [`mqemitter`](https://npm.im/mqemitter), optional.

The plugin adds the following properties to the `app.platformatic` object:

- `mq` — an instance of [`mqemitter`](https://npm.im/mqemitter)
- `subscribe(topics)` — a method to create a node [`Readable`]() that will contain the events emitted by those topics. 

Each entities of `app.platformatic.entities` will be augmented with two functions:

* `entity.getPublishTopic({ ctx, data, action })` 
* `entity.getSubscriptionTopic({ ctx, action })`

Where `ctx` is the GraphQL Context, `data` is the object that will be emitted and `action` is either `save` or `delete`.

#### Usage

```js
'use strict'

const Fastify = require('fastify')
const mapper = require('@platformatic/sql-mapper')
const events = require('@platformatic/sql-events')

async function main() {
  const app = Fastify({
    logger: {
      level: 'info'
    }
  })
  app.register(mapper.plugin, {
    connectionString: 'postgres://postgres:postgres@127.0.0.1/postgres'
  })

  app.register(events)

  // setup your routes


  await app.listen({ port: 3333 })
}

main()
```
