---
title: Build a Todo API
label: Building a Todo API with Platformatic DB
---

import NewApiProjectInstructions from '../../getting-started/new-api-project-instructions.md';
import SetupWatt from '../../getting-started/setup-watt.md';

# Build a Todo API with Platformatic Watt and DB

 In this tutorial, you will build a simple ToDo application using the [Platformatic Watt](../../packages/watt/overview.md) and [DB](../../packages/db/overview.md). Platformatic DB makes it easier to create endpoints that return data from a database application. It automatically generates REST/GraphQL endpoints by mapping your database and then exposes these endpoints to your API consumers.

This guide will walk you through the steps to build Todo CRUD API with Platformatic services, highlighting the differences compared to building traditional APIs.

## Prerequisites
Before we begin, make sure you have the following installed:

- [Node.js](https://nodejs.org/) (v20.16.0+ or v22.3.0+)
- [Platformatic CLI](../../packages/platformatic/cli.md)

## Building a Todo API

This application is a quick way to get started with building APIs on Platformatic. We will be building a simple CRUD API to manage Todo items. Creating a Todo API with Platformatic DB is as easy as creating a database and then mapping it to a GraphQL or REST API.

Let's get started!

## Setting Up the Project

Before you create the database for the Todo application, first setup [Platformatic Watt](../../packages/watt/overview.md), the Node.js application server. Run the command to setup Watt:

<SetupWatt />

### Add Platformatic DB service 

Run the command wizard below in the `web` directory of your Watt application to add a DB service.

<NewApiProjectInstructions />


Run the command to start your application:

```bash
npm start
```

## Setting up Migrations

Platformatic DB uses [SQLite](https://www.sqlite.org/) as the default database for any Platformatic DB application, you can see the SQL definition in the `.env` file in the root folder of your application.

For the Todo API, we need two tables, Users and Todos, let's edit the migrations generated by [Platformatic CLI](../../packages/platformatic/cli.md) to add these tables:

### Creating a Users table

To create the users table, navigate to the `web/db/migrations` directory and edit `001.do.sql` file, and add the schema below:

```sql
CREATE TABLE IF NOT EXISTS Users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

And edit the `db/migrations/001.undo.sql` file to look like this:

```sql
DROP TABLE Users;
```
:::note
To ensure the OpenAPI specification accurately reflects your API endpoints, it's essential to use plural table names.
:::


Before we apply the migrations, let's create a new table for our Todos, to do that create another file `002.do.sql` and inside it, add the schema for your Todos table.

```sql
CREATE TABLE IF NOT EXISTS Todos (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE,
    completed BOOLEAN DEFAULT 0
);
```

And again, add a new file `002.undo.sql` to drop the table.

```sql
DROP TABLE Todos;
```

:::note
See the [Glossary](../glossary.md) for terminologies and definitions used in [Platformatic DB](../../packages/db/overview.md).
:::

Now let's apply the migrations we just created by running the command below:

```bash
npx platformatic db migrations apply
```

Notice that after running migrations, you get a `global.d.ts` and a types folder with all our types and interfaces automatically generated by [Platformatic DB](../../packages/db/overview.md). The `global.d.ts` file is used for querying the Platformatic database.

Now, start your Platformatic DB application by running:

```bash
npm run dev
```

Now you'll see this screen when you open `http://0.0.0.0:3042/` in your browser:

![Platformatic DB local server](../images/plt-localhost.png)

### Testing API endpoints

To test our API endpoints from Platformatic, click on the **OpenAPI Documentation link**  on this page `http://0.0.0.0:3042/`. This will open the [Swagger editor](https://docs.scalar.com/swagger-editor) with all the API endpoints we just created.

![Todo API endpoints](../images/plt-endpoints.png)

Click on **Test request** and test the **Create Todo** endpoint as shown below:

![Testing API endpoint](../images/test-endpoint.png)

You should get a **200 OK** status code for a successful request.

### Enable CORS on the API

When we build "like" functionality into our frontend, we'll be making a client
side HTTP request to our GraphQL API. Our backend API and our frontend are running
on different origins, so we need to configure our API to allow requests from
the frontend. This is known as Cross-Origin Resource Sharing (CORS).

To enable CORS on our API, let's open up our API's **`.env`** file and add in
a new setting:

```
PLT_SERVER_CORS_ORIGIN=http://localhost:3000
```

The value of `PLT_SERVER_CORS_ORIGIN` is our frontend application's origin.

Now we can add a `cors` configuration object in our API's configuration file,
**`web/db/platformatic.json`**:

```json
{
// highlight-start
  "server": {
    "cors": {
      "origin": "{PLT_SERVER_CORS_ORIGIN}"
    }
  },
// highlight-end
  ...
}
```

The HTTP responses from all endpoints on our API will now include the header:

```
access-control-allow-origin: http://localhost:3000
```

This will allow JavaScript running on web pages under the `http://localhost:3000`
origin to make requests to our API.


## Conclusion

Congratulations! You have successfully created a simple Todo API using Platformatic. This tutorial covered the basics of setting up a Platformatic project, defining a schema, configuring the service, and creating API endpoints. For more advanced features and configurations, refer to the [Platformatic API Documentation](../../packages/platformatic/cli.md).
