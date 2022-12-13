import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Quick Start Guide

In this guide you'll learn how to create and run your first API with
[Platformatic DB](/docs/reference/db/introduction.md). Let's get started!

:::info

This guide uses [SQLite](https://www.sqlite.org/) for the database, but
Platformatic DB also supports [PostgreSQL](https://www.postgresql.org/),
[MySQL](https://www.mysql.com/) and [MariaDB](https://mariadb.org/) databases.

:::

## Requirements

Platformatic supports macOS, Linux and Windows ([WSL](https://docs.microsoft.com/windows/wsl/) recommended).

To follow along with this guide you'll need to have these things installed:

- [Node.js](https://nodejs.org/) >= v16.17.0 or >= v18.8.0
- [npm](https://docs.npmjs.com/cli/) v7 or later
- A code editor, for example [Visual Studio Code](https://code.visualstudio.com/)

## Create a new API project

Launch the create platormatic command:
Create a directory for your new API project:

```bash
npm create platformatic@latest 
```

This starts the creator wizards. Select "DB" as project type: 
```bash
 Hello, marcopiraccini welcome to Platformatic 0.10.0!
 Let's start by creating a new project.
? Which kind of project do you want to create? (Use arrow keys)
❯ DB 
  Service
```

Then, specify the project folder name:
```
? Where would you like to create your project? (./my-api) quick-start
```

Create default migrations:
```
? Do you want to create default migrations? (Use arrow keys)
❯ yes 
  no
```

Then you can crete an example of plugin too, and decide i you want to use typescript:
```
? Do you want to create a plugin? yes
? Do you want to use TypeScript? no
```

Then the `quick-start` folder is created and you can install all the dependencies (select `yes`):
```
[12:01:30] INFO: Configuration file platformatic.db.json successfully created.
[12:01:30] INFO: Environment file .env successfully created.
[12:01:30] INFO: Migrations folder migrations successfully created.
[12:01:30] INFO: Migration file 001.do.sql successfully created.
[12:01:30] INFO: Migration file 001.undo.sql successfully created.
[12:01:30] INFO: Plugin file created at plugin.js
? Do you want to run npm install? (Use arrow keys)
❯ yes 
  no

```

Finally, you can apply the migrations:

```
? Do you want to apply migrations? (Use arrow keys)
❯ yes 
  no
```

You can answer "no" to the last questions (to generate types and install the Platformatic cloud Github action).

## Check the  database schema

In your project directory (`quick-start`), open the `migrations` directory that can store your database migration files that will contain both the `001.do.sql` and `001.undo.sql` files. The `001.do.sql` file contains the SQL statements to create the database schema, and the `001.undo.sql` file contains the SQL statements to drop the database schema.

```sql title="migrations/001.do.sql"
CREATE TABLE IF NOT EXISTS movies (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL
);
```

Note that this migration has been already applied by Platformatic creator.

:::tip

You can check syntax for SQL queries on the [Database.Guide SQL Reference](https://database.guide/sql-reference-for-beginners/).

:::

## Check your API configurtion

In your project directory, check the Platformatic configuration file named
**`platformatic.db.json`**:

```json title="platformatic.db.json"
{
  "server": {
    "hostname": "{PLT_SERVER_HOSTNAME}",
    "port": "{PORT}",
    "logger": {
      "level": "{PLT_SERVER_LOGGER_LEVEL}"
    }
  },
  "core": {
    "connectionString": "{DATABASE_URL}",
    "graphql": true,
    "openapi": true
  },
  "migrations": {
    "dir": "migrations"
  },
  "plugin": {
    "path": "plugin.js"
  },
  "types": {
    "autogenerate": true
  }
}
```

...and the environment file named **`.env`**:

```bash title=".env"
PLT_SERVER_HOSTNAME=127.0.0.1
PORT=3042
PLT_SERVER_LOGGER_LEVEL=info
DATABASE_URL=sqlite://./db.sqlite
```

This configuration tells Platformatic to:

- Run an API server on `http://127.0.0.1:3042/`
- Connect to an SQLite database stored in a file named `db.sqlite`
- Look for database migration files in the `migrations` directory
- Load the plugin file named `plugin.js` and automatically generate types

:::tip

The [Configuration reference](/docs/reference/db/configuration.md) explains all of the
supported configuration options.

:::

## Start your API server

In your project directory, use the Platformatic CLI to start your API server:

```bash
npm start 
```
or 
```
npx platformatic db start
```

This will:

1. If not already applied, run your SQL migration file and create a `movies` table in the SQLite database.
1. Automatically map your SQL database to REST and GraphQL API interfaces.
1. Start the Platformatic API server.

Your Platformatic API is now up and running! 🌟

## Next steps

### Use the REST API interface

You can use cURL to make requests to the REST interface of your API, for example:

#### Create a new movie

```bash
curl -X POST -H "Content-Type: application/json" \
  -d "{ \"title\": \"Hello Platformatic DB\" }" \
	http://localhost:3042/movies
```

You should receive a response from your API like this:

```json
{"id":1,"title":"Hello Platformatic DB"}
```

#### Get all movies

```bash
curl http://localhost:3042/movies
```

You should receive a response from your API like this, with an array
containing all the movies in your database:

```json
[{"id":1,"title":"Hello Platformatic DB"}]
```

:::tip

Take a look at the [REST API reference](/docs/reference/sql-openapi/introduction.md) for an
overview of the REST interface that the API provides.

:::

#### Swagger OpenAPI documentation

You can explore the OpenAPI documentation for your REST API in the Swagger UI at
[http://localhost:3042/documentation](http://localhost:3042/documentation)

### Use the GraphQL API interface

Open [http://localhost:3042/graphiql](http://localhost:3042/graphiql) in your
web browser to explore the GraphQL interface of your API.

Try out this GraphQL query to retrieve all movies from your API:

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
[GraphQL API reference](/docs/reference/sql-graphql/introduction.md).

:::
