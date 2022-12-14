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

<Tabs groupId="quickstart-create">

<TabItem value="automatic" label="Automatic">

Launch the create platformatic command:

<Tabs groupId="package-manager-create">
<TabItem value="npm" label="npm">

```bash
npm create platformatic@latest 
```

</TabItem>
<TabItem value="yarn" label="yarn">

```bash
yarn create platformatic
```

</TabItem>
<TabItem value="pnpm" label="pnpm">

```bash
pnpm create platformatic
```

</TabItem>
</Tabs>


This starts Platformatic creator wizard, which asks you some questions on how to create the Platformatic project. 
For this quick-start, you should answer the questions as follows:

- Which kind of project do you want to create?  => DB
- Where would you like to create your project?  => quick-start 
- Do you want to create default migrations?     => Yes
- Do you want to create a plugin?               => Yes
- Do you want to use TypeScript?                => No
- Do you want to install dependencies?          => Yes (this can take a while)
- Do you want to apply the migrations?          => Yes
- Do you want to create the github action to deploy this application to Platformatic Cloud? => No

:::info

Please feel free to answer the questions differently, if you want to create a different kind of project.
Just make sure to run the npm/yarn/pnpm `install` manually if not done through the wizard.

:::

Now you have a Platformatic project in the folder `quick-start` with a default migration and a plugin.

## Start your API server

In your project directory, use the Platformatic CLI to start your API server:


```
npx platformatic db start
```
or

```
npm start 
```

This will:

- Automatically map your SQL database to REST and GraphQL API interfaces.
- Start the Platformatic API server.

Your Platformatic API is now up and running! 🌟


## Check the  database schema

In your project directory (`quick-start`), open the `migrations` directory that can store your database migration files that will contain both the `001.do.sql` and `001.undo.sql` files. The `001.do.sql` file contains the SQL statements to create the database objects, while the `001.undo.sql` file contains the SQL statements to drop them.

```sql title="migrations/001.do.sql"
CREATE TABLE IF NOT EXISTS movies (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL
);
```

Note that this migration has been already applied by Platformatic creator.

## Check your API configuration

In your project directory, check the Platformatic configuration file named
**`platformatic.db.json`** and the environment file named **`.env`**:

The created configuration tells Platformatic to:

- Run an API server on `http://127.0.0.1:3042/`
- Connect to an SQLite database stored in a file named `db.sqlite`
- Look for database migration files in the `migrations` directory
- Load the plugin file named `plugin.js` and automatically generate types

:::tip

The [Configuration reference](/docs/reference/db/configuration.md) explains all of the
supported configuration options.

:::

</TabItem>

<TabItem value="manual" label="Manual">

Create a directory for your new API project:

```bash
mkdir quick-start

cd quick-start
```

Then create a `package.json` file and install the [platformatic](https://www.npmjs.com/package/platformatic)
CLI as a project dependency:

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


## Add a database schema

In your project directory (`quick-start`), create a `migrations` directory to
store your database migration files:

```bash
mkdir migrations
```

Then create a new migration file named **`001.do.sql`** in the **`migrations`**
directory.

Copy and paste this SQL query into the migration file:

```sql title="migrations/001.do.sql"
CREATE TABLE movies (
  id INTEGER PRIMARY KEY,
  title VARCHAR(255) NOT NULL
);
```

When it's run by Platformatic, this query will create a new database table
named `movies`.

:::tip

You can check syntax for SQL queries on the [Database.Guide SQL Reference](https://database.guide/sql-reference-for-beginners/).

:::

## Configure your API

In your project directory, create a new Platformatic configuration file named
**`platformatic.db.json`**.

Copy and paste in this configuration:

```json title="platformatic.db.json"
{
  "server": {
    "hostname": "127.0.0.1",
    "port": "3042"
  },
  "core": {
    "connectionString": "sqlite://./db.sqlite"
  },
  "migrations": {
    "dir": "./migrations",
    "autoApply": true
  }
}
```

This configuration tells Platformatic to:

- Run an API server on `http://127.0.0.1:3042/`
- Connect to an SQLite database stored in a file named `db.sqlite`
- Look for database migration files in the `migrations` directory

:::tip

The [Configuration reference](/docs/reference/db/configuration.md) explains all of the
supported configuration options.

:::

## Start your API server

In your project directory, use the Platformatic CLI to start your API server:

```bash
npx platformatic db start
```

This will:

1. Run your SQL migration file and create a `movies` table in the SQLite database.
1. Automatically map your SQL database to REST and GraphQL API interfaces.
1. Start the Platformatic API server.

Your Platformatic API is now up and running! 🌟

</TabItem>
</Tabs>


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
