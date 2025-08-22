---
title: Overview
label: Database Service
---

# Database Service

The Database Service is a core application type that runs within Watt (the Node.js Application Server). It automatically generates GraphQL and REST APIs from your database schema, eliminating the need to write boilerplate CRUD operations.

The Database Service supports PostgreSQL, MySQL, MariaDB, and SQLite, automatically introspecting your database schema to create type-safe, fully-featured APIs with support for relationships, filtering, pagination, and real-time subscriptions.

For a high level overview of how Watt and its applications work, please reference the [Overview](../../overview.md) guide.

## Features

### Automatic API Generation
- **REST/OpenAPI**: Automatically generate a complete [REST API](../sql-openapi/overview.md) from your database schema
- **GraphQL**: Create a [GraphQL API](../sql-graphql/overview.md) with full query, mutation, and subscription support
- **Interactive Documentation**: Access API docs via [Scalar](https://docs.scalar.com/swagger-editor) and [GraphiQL IDE](https://github.com/graphql/graphiql)
- **Apollo Federation**: Extend your API with [federation support](https://www.apollographql.com/docs/federation/)

### Database Support
- **Multi-Database**: Works with PostgreSQL, MySQL, MariaDB, and SQLite
- **Schema Introspection**: Automatically discovers tables, relationships, and constraints
- **Migrations**: Efficient [database migrations](./migrations.md) with version control
- **Type Safety**: Generated TypeScript definitions based on your schema

### Authentication and Authorization
- Secure your APIs with advanced methods such as [JWT, Webhooks, and HTTP Headers](../db/authorization/strategies.md) (for development use).
- Implement [role-based access control (RBAC)](../db/authorization/user-roles-metadata.md) authorization.

### Complete flexibility
- Add custom functionality in a [Fastify plugin](../db/plugin.md).
- Interact with your database via [mapped entities](../sql-mapper/entities/overview.md) or execute [raw SQL queries](../sql-mapper/overview.md).
- Develop plugins in JavaScript or [TypeScript](../platformatic/cli.md#compile).
- Automatically generate types based on SQL tables.

### Usage
- Integrate Platformatic DB [programmatically](../db/programmatic.md) into your tests or other applications for more dynamic usage.

### Command Line usage (CLI)

When using [Watt](../watt/overview.md), `@platformatic/db` applications will make some additional commands available on the terminal.

All the commands will be prefixed by the application id. For instance, if your application id is `movies`, then you will have the following commands available:

- `movies:migrations:create`: Create a new migration file. See the [migration documentation](./migrations.md) for more informations.
- `movies:migrations:apply`: Apply all configured migrations to the database. See the [migration documentation](./migrations.md) for more informations.
- `movies:seed`: Load a seed into the database. See the [seed documentation](./seed.md) for more informations.
- `movies:types`: Generate TypeScript types for your entities from the database.
- `movies:schema`: Prints the OpenAPI or GraphQL schema for the database.

## Quick Start

The easiest way to create a Database Service is within a Watt application:

```bash
# Create a new Watt application
wattpm create my-app

# This will prompt you to add a Database Service
cd my-app

# Start in development mode  
wattpm dev
```

Your Database Service will automatically generate REST and GraphQL APIs based on your database schema. Visit the interactive documentation at `http://localhost:3042/documentation` to explore your APIs.

For application-specific configuration and advanced usage, see the [Configuration](./configuration.md) guide.

## When to Use Database Service

Database Service is perfect when you need:

- **Rapid API Development**: Get CRUD APIs instantly without writing boilerplate code
- **Database-First Design**: Build APIs that directly reflect your database structure
- **Multiple API Formats**: Support both REST and GraphQL clients from the same service
- **Real-time Features**: Built-in GraphQL subscriptions for live data updates
- **Enterprise Features**: Advanced authorization, migrations, and schema management

:::info
Ready to start? Check out our [Getting Started Guide](../../getting-started/quick-start-watt.md) to create your first Watt application with a Database Service! ⚡
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
