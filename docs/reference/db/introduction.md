# Platformatic DB

Platformatic DB is an HTTP server that provides a flexible set of tools for
building robust APIs with Node.js.

For a high level overview of how Platformatic DB works, please reference the
[Architecture](/getting-started/architecture.md) guide.

## Features

- Command-line interface: [`platformatic db`](/reference/cli.md#db)
- Support for [multiple database systems](#supported-databases)
- [Database migrations](/reference/db/migrations.md)
- REST/OpenAPI
  - Automatic [REST API](/reference/sql-openapi/introduction.md) from your database schema
  - Interactive documentation ([Scalar](https://docs.scalar.com/swagger-editor))
  - [OpenAPI 3.0](https://swagger.io/resources/open-api/) schema
- GraphQL
  - Automatic [GraphQL API](/reference/sql-graphql/introduction.md) from your
  database schema
  - Support for [Apollo Federation](https://www.apollographql.com/apollo-federation/)
  - Web based GraphQL IDE ([GraphiQL](https://github.com/graphql/graphiql))
  - Generated GraphQL schema
- [Authentication & authorization](/reference/db/authorization/introduction.md)
  - Supported methods: JWT, Webhook, HTTP Headers (development only)
  - Authorization via role based access control (RBAC)
- Complete flexibility
  - Add custom functionality in a [Fastify plugin](/reference/db/plugin.md)
  - Execute database operations via [mapped entities](/reference/sql-mapper/entities/introduction.md)
  - Write and execute [raw SQL queries](/reference/sql-mapper/introduction.md)
  - Write plugins in JavaScript or [TypeScript](/reference/cli.md#compile)
  - Automatic generation of types based on the SQL tables
- Start Platformatic DB [programmatically](/reference/db/programmatic.md) in tests or other applications

:::info
Get up and running in 2 minutes using our
[Quick Start Guide](/getting-started/quick-start-guide.md) ⚡
:::

## Supported databases

| Database                                  | Version  |
|-------------------------------------------|----------|
| [SQLite](https://www.sqlite.org/)         | 3.       |
| [PostgreSQL](https://www.postgresql.org/) | >= 15    |
| [MySQL](https://www.mysql.com/)           | >= 5.7   |
| [MariaDB](https://mariadb.org/)           | >= 10.11 |


The required database driver is automatically inferred and loaded based on the
value of the [`connectionString`](/reference/db/configuration.md#core)
configuration setting.

## Issues

If you run into a bug or have a suggestion for improvement, please
[raise an issue on GitHub](https://github.com/platformatic/platformatic/issues/new). 
