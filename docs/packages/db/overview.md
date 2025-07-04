---
title: Overview
label: Platformatic DB
---

# Platformatic DB

Platformatic DB is an HTTP server that provides a flexible set of tools for
building robust APIs with Node.js.

For a high level overview of how Platformatic DB works, please reference the
[Introduction](../Overview.md) guide.

## Features

### Multiple Database Support 
- Integration with [multiple database systems](#supported-databases)
- Efficient [Database migrations](./migrations.md)
  
### REST/OpenAPI
- Automatically generate a [REST API](../packages/sql-openapi/overview.md) from your database schema.
- Access interactive documentation via [Scalar](https://docs.scalar.com/swagger-editor).
- Generate [OpenAPI 3.0](https://swagger.io/resources/open-api/) schema.

### GraphQL

- Create a [GraphQL API](../packages/sql-graphql/overview.md) directly from your database schema.
- Extend your API with [Apollo Federation](https://www.apollographql.com/docs/federation/).
- Explore your API with the web-based [GraphiQL IDE](https://github.com/graphql/graphiql).

### Authentication and Authorization
- Secure your APIs with advanced methods such as [JWT, Webhooks, and HTTP Headers](../db/authorization/strategies.md) (for development use).
- Implement [role-based access control (RBAC)](../db/authorization/user-roles-metadata.md) authorization.

### Complete flexibility
- Add custom functionality in a [Fastify plugin](../db/plugin.md).
- Interact with your database via [mapped entities](../packages/sql-mapper/entities/overview.md) or execute [raw SQL queries](../packages/sql-mapper/overview.md).
- Develop plugins in JavaScript or [TypeScript](../cli.md#compile).
- Automatically generate types based on SQL tables.

### Usage
- Integrate Platformatic DB [programmatically](../db/programmatic.md) into your tests or other applications for more dynamic usage.

### Command Line usage (CLI)

When using [Watt](../watt/overview.md), `@platformatic/db` services will make some additional commands available on the terminal.

All the commands will be prefixed by the service id. For instance, if your service id is `movies`, then you will have the following commands available:

* `movies:migrations:create`: Create a new migration file. See the [migration documentation](./migrations.md) for more informations.
* `movies:migrations:apply`: Apply all configured migrations to the database. See the [migration documentation](./migrations.md) for more informations.
* `movies:seed`: Load a seed into the database. See the [seed documentation](./seed.md) for more informations.
* `movies:types`: Generate TypeScript types for your entities from the database.
* `movies:schema`: Prints the OpenAPI or GraphQL schema for the database.

:::info

Ready to start? Dive into our [Quick Start Guide](../getting-started/quick-start-guide.md) and get your API up and running in just 2 minutes! ⚡
:::

## Supported databases

| Database                                  | Version  |
|-------------------------------------------|----------|
| [SQLite](https://www.sqlite.org/)         | 3.x       |
| [PostgreSQL](https://www.postgresql.org/) | >= 15    |
| [MySQL](https://www.mysql.com/)           | >= 5.7   |
| [MariaDB](https://mariadb.org/)           | >= 10.11 |


The database driver is automatically loaded based on the value [`connectionString`](../db/configuration.md#db) configuration setting.

## Issues

If you run into a bug or have a suggestion for improvement, please raise an 
[issue on GitHub](https://github.com/platformatic/platformatic/issues/new) or join our [Discord feedback](https://discord.gg/platformatic) channel.
