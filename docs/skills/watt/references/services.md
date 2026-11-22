# Services, gateways, and databases

## HTTP service

Use compatible Watt 4 `wattpm` and `@platformatic/service`. Create `plugins/`, `routes/`,
and `test/`. An ESM `watt.config.js`:

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

`routes/hello.js`:

```js
export default async function (app) {
  app.get('/hello', async () => ({ hello: 'world' }))
}
```

Shared decorators belong in non-encapsulated plugins. In TypeScript, augment Fastify
types and use public package types, not generated CommonJS declarations in an ESM app.
Omit `server.port` for internal services where the capability supports it.

Test through the capability API, keeping overrides separate from production:

```js
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

Retain the project's test runner and module convention.

## Gateway

Use `@platformatic/gateway`. Its own listener exposes the public API:

```js config
import { createGatewayConfig } from '@platformatic/gateway'

export default createGatewayConfig({
  server: {
    hostname: process.env.HOST || '127.0.0.1',
    port: Number(process.env.PORT || 3042)
  },
  gateway: { applications: [{ id: 'api' }] }
})
```

Read [enterprise](enterprise.md) for prefix rewriting, OpenAPI composition, internal
and remote applications. Preserve authentication and request/response schemas. Check
both API routes and frontend assets through the gateway.

## Database

Use `@platformatic/db`. Ask which database is wanted; do not switch an existing project
to SQLite. Local connection examples, never production credentials:

| Database | Connection |
| --- | --- |
| SQLite | `sqlite://./db.sqlite` |
| PostgreSQL | `postgres://postgres:postgres@127.0.0.1:5432/postgres` |
| MySQL/MariaDB | `mysql://root@127.0.0.1:3306/platformatic` |

An example for a deliberately chosen SQLite development database:

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

Only enable REST/GraphQL, types, and schema locking when needed. Ignore/watch-exclude
SQLite files and journals. Offer a local DB container without replacing infrastructure.
Preserve authorization, including admin-secret behavior where configured.

Create paired `migrations/001.do.sql` and `001.undo.sql`:

```sql
CREATE TABLE movies (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL
);
```

```sql
DROP TABLE movies;
```

This key syntax is SQLite; PostgreSQL needs identity/serial, MySQL/MariaDB auto-increment.
Do not run either migration without permission or implicitly enable production auto-apply.
Use an isolated test DB, close resources, and clean up only test-owned artifacts.
Read the [DB reference](https://docs.platformatic.dev/docs/reference/db/configuration)
for seeds, authorization, locking, and type-generation commands.

Finish with scripts, env examples, ignore rules, README, and tests as in
[scaffolding](scaffolding.md). Use application-specific port/database environment names
when multiple applications need different values.
