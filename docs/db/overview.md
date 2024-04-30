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

### Command Line Interface 
- Easily manage your databases with the `platformatic db` [CLI](../cli.md#db).

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
