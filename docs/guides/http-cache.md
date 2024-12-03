# Configure HTTP Caching for Platformatic App

Platformatic Runtime supports HTTP requests caching out of the box. This feature is useful to reduce the number of requests to the same resource and improve the performance of your application.

## Enable HTTP Caching

Let's create a simple Platformatic app to demonstrate how to enable HTTP caching.

```bash
npx create-platformatic@latest
```

Here are the answers to the questions to create a Platformatic app with one Platformatic Composer service named `main` and one Platformatic Service service named `internal`.

```bash
? Where would you like to create your project? .
? Which kind of project do you want to create? @platformatic/composer
? What is the name of the service? main
? Do you want to create another service? yes
? Which kind of project do you want to create? @platformatic/service
? What is the name of the service? internal
? Do you want to create another service? no
? Which service should be exposed? main
? Do you want to use TypeScript? no
? What port do you want to use? 3042
? Do you want to init the git repository? no
```

To enable HTTP caching, let's set the `httpCache` property to `true` in the root `platformatic.json` file.

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/runtime/2.19.0.json",
  "entrypoint": "main",
  "watch": true,
  "autoload": {
    "path": "services",
    "exclude": [
      "docs"
    ]
  },
  "logger": {
    "level": "{PLT_SERVER_LOGGER_LEVEL}"
  },
  "server": {
    "hostname": "{PLT_SERVER_HOSTNAME}",
    "port": "{PORT}"
  },
  "managementApi": "{PLT_MANAGEMENT_API}",
  "httpCache": true
}
```

Now when the httpCache is enabled, let's add a cache control header to the response of the API. You can do this by adding a `cacheControl` property to the response object.

Let's add a cached route to the `./services/internal/routes/root.js` file.

```js
/// <reference path="../global.d.ts" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.get('/example', async (request, reply) => {
    return { hello: fastify.example }
  })

  let counter = 0
  fastify.get('/cached-counter', async (request, reply) => {
    reply.header('Cache-Control', 'public, max-age=10')
    return { counter: counter++ }
  })
}
```

Now, let's start the Platformatic app.

```bash
npm run start
```

Let's test the `/cached-counter` route using `curl`.

```bash
curl http://localhost:3042/internal/cached-counter
{"counter":0}
```

```bash
curl http://localhost:3042/internal/cached-counter
{"counter":0}
```

...and after 10 seconds...

```bash
curl http://localhost:3042/internal/cached-counter
{"counter":1}
```

## Http Cache invalidation

By default the cache is invalidated when the `max-age` is reached. However, you can invalidate the cache manually by calling the `globalThis.platformatic.invalidateHttpCache` method.

Let's add another route to the `./services/internal/routes/root.js` file that invalidates the cache for the `/cached-counter` route. And also increase the `max-age` to 180 seconds to be sure that the cache is invalidated and not just expired.

```js
/// <reference path="../global.d.ts" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.get('/example', async (request, reply) => {
    return { hello: fastify.example }
  })

  let counter = 0
  fastify.get('/cached-counter', async (request, reply) => {
    reply.header('Cache-Control', 'public, max-age=180')
    return { counter: counter++ }
  })

  fastify.delete('/invalidate-cached-counter', async () => {
    await globalThis.platformatic.invalidateHttpCache({
      keys: [
        {
          origin: 'http://internal.plt.local',
          path: '/cached-counter',
          method: 'GET'
        }
      ]
    })
  })
}
```

Let's start the Platformatic app.

```bash
npm run start
```

Let's test the `/cached-counter` route using `curl`.

```bash
curl http://localhost:3042/internal/cached-counter
{"counter":0}
```

Now, let's invalidate the cache for the `/cached-counter` route.

```bash
curl -X DELETE http://localhost:3042/internal/invalidate-cached-counter
```

And test the `/cached-counter` route again.

```bash
curl http://localhost:3042/internal/cached-counter
{"counter":1}
```

## Invalidating cache by cache tags

Platformatic Runtime supports cache tags to invalidate related cache entries. Cache tags 
should be set in one of the response headers. Cache tags should be globally unique.

Let's set the `X-Cache-Tags` header in the root `platformatic.json` file.

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/runtime/2.19.0.json",
  "entrypoint": "main",
  "watch": true,
  "autoload": {
    "path": "services",
    "exclude": [
      "docs"
    ]
  },
  "logger": {
    "level": "{PLT_SERVER_LOGGER_LEVEL}"
  },
  "server": {
    "hostname": "{PLT_SERVER_HOSTNAME}",
    "port": "{PORT}"
  },
  "managementApi": "{PLT_MANAGEMENT_API}",
  "httpCache": {
    "cacheTagsHeader": "X-Cache-Tags"
  }
}
```

Now, let's add a cache tag to the response of the API. And also modify the `/invalidate-cached-counter` route to invalidate the cache by the cache tag.

```js
/// <reference path="../global.d.ts" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.get('/example', async (request, reply) => {
    return { hello: fastify.example }
  })

  let counter = 0
  fastify.get('/cached-counter', async (request, reply) => {
    reply.header('Cache-Control', 'public, s-maxage=180')
    reply.header('X-Cache-Tags', 'cached-counter-tag')
    return { counter: counter++ }
  })

  fastify.post('/invalidate-cached-counter', async () => {
    await globalThis.platformatic.invalidateHttpCache({
      tags: ['cached-counter-tag']
    })
  })
}
```

Let's start the Platformatic app.

```bash
npm run start
```

Let's test the `/cached-counter` route using `curl`.

```bash
curl http://localhost:3042/internal/cached-counter
{"counter":0}
```

```bash
curl http://localhost:3042/internal/cached-counter
{"counter":0}
```

Now, let's invalidate the cache for the `/cached-counter` route by the cache tag.

```bash
curl -X POST http://localhost:3042/internal/invalidate-cached-counter
```

And test the `/cached-counter` route again.

```bash
curl http://localhost:3042/internal/cached-counter
{"counter":1}
```
