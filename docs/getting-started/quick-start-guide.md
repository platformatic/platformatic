import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

import NewApiProjectInstructions from './new-api-project-instructions.md';

# Quick Start Guide

Welcome to your first steps with [Platformatic DB](/docs/reference/db/introduction.md). This guide will help you set up and run your first API using Platformatic DB with [SQLite](https://www.sqlite.org/). By the end of this guide, you'll have a fully functional API ready to use.

:::note

While this guide uses [SQLite](https://www.sqlite.org/), Platformatic DB also supports [PostgreSQL](https://www.postgresql.org/), [MySQL](https://www.mysql.com/), and [MariaDB](https://mariadb.org/). For more details on database compatibility, see the [Platformatic DB documentation](/docs/reference/db/introduction.md).

:::

## Prerequisites

Before starting, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18.8.0 or higher)
- [npm](https://docs.npmjs.com/cli/) (v7 or higher)
- A code editor, (e.g., [Visual Studio Code](https://code.visualstudio.com/))

## Automatic Setup with Platformatic CLI

<NewApiProjectInstructions/>

### Start Your API Server

Run the following command in your project directory to start your API server:

<Tabs groupId="package-manager">
<TabItem value="npm" label="npm">

```bash
npm start
```

</TabItem>
<TabItem value="yarn" label="yarn">

```bash
yarn run start
```

</TabItem>

<TabItem value="pnpm" label="pnpm">

```bash
pnpm start
```

</TabItem>
</Tabs>


Your API server is now live! 🌟 It will automatically serve REST and GraphQL interfaces for your SQL database.

### Check The Database Schema

Navigate to the `migrations` directory within the `services` folder of your project directory. This folder contains your database migration files: 

- `001.do.sql`: contains the SQL statements for creating database objects.
- `001.undo.sql`: contains the SQL statements to remove database objects. 

### Check Your API configuration

Examine the `platformatic.json` file in the services folder and the `.env` file in the root of your project directory to confirm the API configuration:

This generated configuration tells Platformatic to:

- Run an API server on `http://0.0.0.0:3042/`
- Connect to an SQLite database stored in a file named `db.sqlite`
- Look for database migration files in the `migrations` directory
- Auto-apply the migrations
- Load the plugin file named `plugin.js` and automatically generate types

:::tip

You can learn more about configuration options in the [Configuration reference](../db/configuration.md). 

:::

## Manual setup

Follow the steps below if you prefer setting up manually or need custom configurations:

### Initialize Your Project

Create and navigate into your project directory:

```bash
mkdir quick-start
cd quick-start
```

Initialize your project and install [Platformatic](https://www.npmjs.com/package/platformatic) as a dependency using your preferred package manager:

<Tabs groupId="package-manager">
<TabItem value="npm" label="npm">

```bash
npm init --yes

npm install platformatic
```

</TabItem>
<TabItem value="yarn" label="yarn">

```bash
yarn init --yes

yarn add platformatic
```

</TabItem>
<TabItem value="pnpm" label="pnpm">

```bash
pnpm init

pnpm add platformatic
```

</TabItem>
</Tabs>

### Configuration Your Database

In your project directory (`quick-start`), create a file for your sqlite database and also, a `migrations` directory to
store your database migration files:

```bash
touch db.sqlite
mkdir migrations
```

Create a new migration file named **`001.do.sql`** in the **`migrations`**
directory. Copy and paste the SQL query below into the migration file to create a new database table
named `movies`:

```sql title="migrations/001.do.sql"
CREATE TABLE movies (
  id INTEGER PRIMARY KEY,
  title VARCHAR(255) NOT NULL
);
```

:::tip

You can check syntax for SQL queries on the [Database Guide SQL Reference](https://database.guide/sql-reference-for-beginners/).

:::

### Configure Your API

Create a new Platformatic configuration file named **`platformatic.json`** in your project directory with the following configuration to set up your server and database:

```json title="platformatic.json"
{
  "server": {
    "hostname": "127.0.0.1",
    "port": "3042"
  },
  "db": {
    "connectionString": "sqlite://./db.sqlite"
  },
  "migrations": {
    "dir": "./migrations",
    "autoApply": "true"
  }
}
```

This configuration tells Platformatic to:

- Run an API server on `http://127.0.0.1:3042/`
- Connect to an SQLite database stored in a file named `db.sqlite`
- Look for, and apply the database migrations specified in the `migrations` directory


### Start Your API Server

In your project directory, use the Platformatic CLI to start your API server:

```bash
npx platformatic db start
```

This will:
- Automatically map your SQL database to REST and GraphQL API interfaces.
- Start the Platformatic API server.

Your Platformatic API is now up and running! 🌟

## Next Steps

Now that your API is up and running, it's time to interact with it using the REST and GraphQL interfaces. Below, you'll find simple examples of how to use these interfaces effectively.

### Interacting with the REST API Interface

The REST API allows you to perform standard HTTP requests. Below are examples of how you can create a new movie and retrieve all movies from your database using `cURL`.

#### Create a new movie

To add a new movie to your database, use this `cURL` command:

```bash
curl -X POST -H "Content-Type: application/json" \
  -d "{ \"title\": \"Hello Platformatic DB\" }" \
	http://localhost:3042/movies
```

You should receive a response similar to this:

```json
{"id":1,"title":"Hello Platformatic DB"}
```
This means that the movie was successfully added to your database


#### Get All Movies

To fetch all movies stored in your database, use the following command

```bash
curl http://localhost:3042/movies
```

The response will be an array containing all the movies:

```json
[{"id":1,"title":"Hello Platformatic DB"}]
```

:::tip

For a comprehensive list of available routes and operations, refer to the [REST API reference](/docs/reference/sql-openapi/introduction.md)

:::

#### Exploring API Documentation with Swagger

You can access the Swagger UI to explore detailed documentation for your REST API at:

[http://localhost:3042/documentation](http://localhost:3042/documentation)

### Interacting with the GraphQL Interface

Open [http://localhost:3042/graphiql](http://localhost:3042/graphiql) in your
web browser to explore the GraphQL interface of your API.

Run the query below to retrieve all movies:

```graphql
query {
  movies {
    id
    title
  }
}
```

:::tip

Learn more about your API's GraphQL interface in the
[GraphQL API reference](../packages/sql-graphql/overview.md).

:::

