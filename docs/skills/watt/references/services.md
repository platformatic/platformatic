---
title: Create Services, Gateways, and Databases
---

# Create services, gateways, and databases

## HTTP service

Install compatible `wattpm` and `@platformatic/service` versions. Create `plugins/`
for decorators and shared behavior, `routes/` for endpoints, and `test/` for tests.
Use `watt.config.js`:

```js config
import { createServiceConfig } from '@platformatic/service'

export default createServiceConfig({
  server: {
    hostname: process.env.HOST || '127.0.0.1',
    port: Number(process.env.PORT || 3042)
  },
  plugins: {
    paths: [
      { path: './plugins', encapsulate: false },
      { path: './routes' }
    ]
  }
})
```

For `routes/hello.js`:

```js source
export default async function (app) {
  app.get('/hello', async () => ({ hello: 'world' }))
}
```

Decorators used by routes belong in non-encapsulated plugins. In TypeScript, add
Fastify module augmentation for custom decorators and use the package's public types.
Do not generate stale CommonJS declarations for an ESM project.

Test through the capability API, keeping database and other configuration overrides
isolated from production:

```js source
import { create } from '@platformatic/service'
import { strictEqual } from 'node:assert'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import configuration from '../watt.config.js'

test('hello route', async t => {
  const application = await create(fileURLToPath(new URL('../', import.meta.url)), {
    ...configuration,
    server: { ...configuration.server, port: 0 },
    watch: false
  })
  t.after(() => application.stop())
  await application.start({})
  const response = await application.getApplication().inject('/hello')
  strictEqual(response.statusCode, 200)
})
```

Keep tests runnable with the
project's existing test runner and module convention.

## Gateway

Use `@platformatic/gateway`, not the removed scaffolding generators. Create a gateway
application and configure its own listener when it should expose the public API:

```js config
import { createGatewayConfig } from '@platformatic/gateway'

export default createGatewayConfig({
  server: { port: Number(process.env.PORT || 3042) },
  gateway: {
    applications: [{ id: 'api' }]
  }
})
```

Inspect the gateway schema for routing, prefix rewriting, OpenAPI composition,
proxying frontend applications, and remote origins. Retain request/response schemas
and auth behavior. Verify both API paths and frontend assets through the gateway.

## Database application

Use `@platformatic/db`. Ask which database to use before creating migrations; do
not assume an existing project should switch to SQLite. Supported connection examples:

| Database | Development connection string |
| --- | --- |
| SQLite | `sqlite://./db.sqlite` |
| PostgreSQL | `postgres://postgres:postgres@127.0.0.1:5432/postgres` |
| MySQL / MariaDB | `mysql://root@127.0.0.1:3306/platformatic` |

These are local examples, not production credentials. Use `DATABASE_URL` from the
environment and keep passwords out of source control:

```js config
import { createDbConfig } from '@platformatic/db'

export default createDbConfig({
  server: { port: Number(process.env.PORT || 3042) },
  db: {
    connectionString: process.env.DATABASE_URL || 'sqlite://./db.sqlite',
    graphql: true,
    openapi: true
  },
  migrations: {
    dir: './migrations',
    autoApply: process.env.APPLY_MIGRATIONS === 'true'
  },
  types: { autogenerate: true }
})
```

Only enable GraphQL, OpenAPI, generated types, or schema locking when needed.
Add SQLite files and journals to ignore/watch exclusions. For PostgreSQL or MySQL,
offer a local container setup without replacing existing infrastructure.

Create paired migrations, for example `migrations/001.do.sql` and `001.undo.sql`:

```sql
CREATE TABLE movies (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL
);
```

```sql
DROP TABLE movies;
```

The example is SQLite. PostgreSQL requires an identity/serial key; MySQL and MariaDB
require an auto-increment key. Never run undo or apply schema changes on a user's
database without permission. Do not enable production auto-apply implicitly.

Tests must use an isolated database and exercise REST/GraphQL operations when enabled.
Close the application and database resources and clean up only test-owned artifacts.
For seed files, authorization, and type generation, read the DB reference instead of
inventing commands or reusing generator template internals.

## Project finishing

Add scripts, an env example, ignore rules, README usage, and endpoint tests as in
[scaffolding](scaffolding.md). In a workspace, keep capability dependencies in their
owning package and configure public listeners only where needed. Use environment names unique
to each application when multiple services need different database URLs or ports.
