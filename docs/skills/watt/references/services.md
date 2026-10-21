# Services, gateways, and databases

Use major 3 capability packages matching the application. `module` identifies the
capability in these examples; optional schema URLs must use the installed version.

## Service

`@platformatic/service` hosts Fastify plugins and can expose OpenAPI:

```json
{
  "module": "@platformatic/service",
  "plugins": { "paths": ["./app.js"] },
  "service": { "openapi": true }
}
```

Export an async Fastify plugin from `app.js`. Keep plugin registration, route schemas,
authentication, and close hooks in the application's established conventions. Use
`@platformatic/node` when preserving an existing Fastify factory is a better fit.

## Gateway

Use `@platformatic/gateway` and `gateway.applications` for new configurations:

```json
{
  "module": "@platformatic/gateway",
  "gateway": {
    "applications": [
      { "id": "api", "proxy": { "prefix": "/api" } }
    ]
  }
}
```

In a runtime, the ID resolves the application; an `internal://` origin is unnecessary.
For API composition, inspect the installed `openapi` and `graphql` options rather than
assuming that a plain proxy aggregates schemas. Verify prefix rewriting and redirects.

## Database

`@platformatic/db` can expose REST and GraphQL APIs over the supported database:

```json
{
  "module": "@platformatic/db",
  "db": {
    "connectionString": "{DATABASE_URL}",
    "openapi": true,
    "graphql": true
  }
}
```

Choose and document authorization before exposing these APIs publicly. Preserve
existing connection settings, migrations, and database ownership. An admin secret is
not a replacement for per-user authorization. Review connection-pool sizes across workers.

Use migration directories and commands supported by the installed capability. Running
migrations or enabling `autoApply` changes persistent state and needs an explicit
deployment decision. Do not enable automatic migrations merely to make startup succeed.

See [scaffolding](scaffolding.md), [enterprise](enterprise.md), and
[operations](operations.md) for wiring these applications into a runtime.
