import NewApiProjectInstructions from '../getting-started/new-api-project-instructions.md';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';


# Movie Quotes App Tutorial

This tutorial will help you learn how to build a full stack application on top
of Platformatic DB. We're going to build an application that allows us to
save our favourite movie quotes. We'll also be building in custom API functionality
that allows for some neat user interaction on our frontend.

You can find the complete code for the application that we're going to build
[on GitHub](https://github.com/platformatic/tutorial-movie-quotes-app).

:::note

We'll be building the frontend of our application with the [Astro](https://astro.build/)
framework, but the GraphQL API integration steps that we're going to cover can
be applied with most frontend frameworks.

:::

## What we're going to cover

In this tutorial we'll learn how to:

- Create a Platformatic API
- Apply database migrations
- Create relationships between our API entities
- Populate our database tables
- Build a frontend application that integrates with our GraphQL API
- Extend our API with custom functionality
- Enable CORS on our Platformatic API

## Prerequisites

To follow along with this tutorial you'll need to have these things installed:

- [Node.js](https://nodejs.org/) >= v18.8.0 or >= v20.6.0
- [npm](https://docs.npmjs.com/cli/) v7 or later
- A code editor, for example [Visual Studio Code](https://code.visualstudio.com/)

You'll also need to have some experience with JavaScript, and be comfortable with
running commands in a terminal.

## Build the backend

### Create a Platformatic API

First, let's create our project directory:

```bash
mkdir -p tutorial-movie-quotes-app/apps/movie-quotes-api/

cd tutorial-movie-quotes-app/apps/movie-quotes-api/
```

<NewApiProjectInstructions/>

### Define the database schema

Let's create a new directory to store our migration files:

```bash
mkdir migrations
```

Then we'll create a migration file named **`001.do.sql`** in the **`migrations`**
directory:

```sql
CREATE TABLE quotes (
  id INTEGER PRIMARY KEY,
  quote TEXT NOT NULL,
  said_by VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Now let's setup `migrations` in our Platformatic configuration
file, **`platformatic.db.json`**:

```json
{
  "$schema": "https://platformatic.dev/schemas/v0.23.2/db",
  "server": {
    "hostname": "{PLT_SERVER_HOSTNAME}",
    "port": "{PORT}",
    "logger": {
      "level": "{PLT_SERVER_LOGGER_LEVEL}"
    }
  },
  "db": {
    "connectionString": "{DATABASE_URL}",
    "graphql": true,
    "openapi": true
  },
  "plugins": {
    "paths": [
      "plugin.js"
    ]
  },
  "types": {
    "autogenerate": true
  },
  "migrations": {
    "dir": "migrations",
    "autoApply": true
  }
}
```

:::info

Take a look at the [Configuration reference](../db/configuration.md)
to see all the supported configuration settings.

:::

Now we can start the Platformatic DB server:

```bash
npm run start
```

Our Platformatic DB server should start, and we'll see messages like these:

```
[11:26:48.772] INFO (15235): running 001.do.sql
[11:26:48.864] INFO (15235): server listening
    url: "http://127.0.0.1:3042"
```

Let's open a new terminal and make a request to our server's REST API that
creates a new quote:

```bash
curl --request POST --header "Content-Type: application/json" \
  -d "{ \"quote\": \"Toto, I've got a feeling we're not in Kansas anymore.\", \"saidBy\": \"Dorothy Gale\" }" \
  http://localhost:3042/quotes
```

We should receive a response like this from the API:

```json
{"id":1,"quote":"Toto, I've got a feeling we're not in Kansas anymore.","saidBy":"Dorothy Gale","createdAt":"1684167422600"}
```

### Create an entity relationship

Now let's create a migration file named **`002.do.sql`** in the **`migrations`**
directory:

```sql
CREATE TABLE movies (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

ALTER TABLE quotes ADD COLUMN movie_id INTEGER REFERENCES movies(id);
```

This SQL will create a new `movies` database table and also add a `movie_id`
column to the `quotes` table. This will allow us to store movie data in the
`movies` table and then reference them by ID in our `quotes` table.

Let's stop the Platformatic DB server with `Ctrl + C`, and then start it again:

```bash
npm run start
```

The new migration should be automatically applied and we'll see the log message
`running 002.do.sql`.

<Tabs>
<TabItem value="graphql" label="GraphQL">
Our Platformatic DB server also provides a GraphQL API. Let's open up the GraphiQL
application in our web browser:

> http://localhost:3042/graphiql

Now let's run this query with GraphiQL to add the movie for the quote that we
added earlier:

```graphql
mutation {
  saveMovie(input: { name: "The Wizard of Oz" }) {
    id
  }
}
```

We should receive a response like this from the API:

```json
{
  "data": {
    "saveMovie": {
      "id": "1"
    }
  }
}
```

Now we can update our quote to reference the movie:

```graphql
mutation {
  saveQuote(input: { id: 1, movieId: 1 }) {
    id
    quote
    saidBy
    createdAt
    movie {
      id
      name
    }
  }
}
```

We should receive a response like this from the API:

```json
{
  "data": {
    "saveQuote": {
      "id": "1",
      "quote": "Toto, I've got a feeling we're not in Kansas anymore.",
      "saidBy": "Dorothy Gale",
      "movie": {
        "id": "1",
        "name": "The Wizard of Oz"
      }
    }
  }
}
```

Our Platformatic DB server has automatically identified the relationship
between our `quotes` and `movies` database tables. This allows us to make
GraphQL queries that retrieve quotes and their associated movies at the same
time. For example, to retrieve all quotes from our database we can run:

```graphql
query {
  quotes {
    id
    quote
    saidBy
    createdAt
    movie {
      id
      name
    }
  }
}
```

To view the GraphQL schema that's generated for our API by Platformatic DB,
we can run this command in our terminal:

```bash
npx platformatic db schema graphql
```

The GraphQL schema shows all of the queries and mutations that we can run
against our GraphQL API, as well as the types of data that it expects as input.
</TabItem>
<TabItem value="rest" label="Rest API">
This is for Open APi Platformatic Rest API with Open API. 
</TabItem>
</Tabs>


### Populate the database

Our movie quotes database is looking a little empty! We're going to create a
"seed" script to populate it with some data.

Let's create a new file named **`seed.js`** and copy and paste in this code:

```javascript
'use strict'

const quotes = [
  {
    quote: "Toto, I've got a feeling we're not in Kansas anymore.",
    saidBy: 'Dorothy Gale',
    movie: 'The Wizard of Oz'
  },
  {
    quote: "You're gonna need a bigger boat.",
    saidBy: 'Martin Brody',
    movie: 'Jaws'
  },
  {
    quote: 'May the Force be with you.',
    saidBy: 'Han Solo',
    movie: 'Star Wars'
  },
  {
    quote: 'I have always depended on the kindness of strangers.',
    saidBy: 'Blanche DuBois',
    movie: 'A Streetcar Named Desire'
  }
]

module.exports = async function ({ entities, db, sql }) {
  for (const values of quotes) {
    const movie = await entities.movie.save({ input: { name: values.movie } })

    console.log('Created movie:', movie)

    const quote = {
      quote: values.quote,
      saidBy: values.saidBy,
      movieId: movie.id
    }

    await entities.quote.save({ input: quote })

    console.log('Created quote:', quote)
  }
}
```

:::info
Take a look at the [Seed a Database](/guides/seed-a-database.md) guide to learn more
about how database seeding works with Platformatic DB.
:::

Let's stop our Platformatic DB server running and remove our SQLite database:

```
rm db.sqlite
```

Now let's create a fresh SQLite database by running our migrations:

```bash
npx platformatic db migrations apply
```

And then let's populate the `quotes` and `movies` tables with data using our
seed script:

```bash
npx platformatic db seed seed.js
```

Our database is full of data, but we don't have anywhere to display it. It's
time to start building our frontend!





## Build a "like" quote feature

We've built all the basic CRUD (Create, Retrieve, Update & Delete) features
into our application. Now let's build a feature so that users can interact
and "like" their favourite movie quotes.

To build this feature we're going to add custom functionality to our API
and then add a new component, along with some client side JavaScript, to
our frontend.

### Create an API migration

We're now going to work on the code for API, under the **`apps/movie-quotes-api`**
directory.

First let's create a migration that adds a `likes` column to our `quotes`
database table. We'll create a new migration file, **`migrations/003.do.sql`**:

```sql
ALTER TABLE quotes ADD COLUMN likes INTEGER default 0;
```

This migration will automatically be applied when we next start our Platformatic
API.

### Create an API plugin

To add custom functionality to our Platformatic API, we need to create a
[Fastify plugin](https://www.fastify.io/docs/latest/Reference/Plugins/) and
update our API configuration to use it.

Let's create a new file, **`plugin.js`**, and inside it we'll add the skeleton
structure for our plugin:

```javascript
// plugin.js

'use strict'

module.exports = async function plugin (app) {
  app.log.info('plugin loaded')
}
```

Now let's register our plugin in our API configuration file, **`platformatic.db.json`**:

```json
{
  ...
  "migrations": {
    "dir": "./migrations"
// highlight-start
  },
  "plugins": {
    "paths": ["./plugin.js"]
  }
// highlight-end
}
```

And then we'll start up our Platformatic API:

```bash
npm run dev
```

We should see log messages that tell us that our new migration has been
applied and our plugin has been loaded:

```
[10:09:20.052] INFO (146270): running 003.do.sql
[10:09:20.129] INFO (146270): plugin loaded
[10:09:20.209] INFO (146270): server listening
    url: "http://127.0.0.1:3042"
```

Now it's time to start adding some custom functionality inside our plugin.

## Add a REST API route

<!--
TODO: As we're only using the GraphQL API from our frontend, should we skip creating a REST API route?

It's good for completeness, but adds complexity to this tutorial.
Could be a good "bonus points" activity in the workshop?
-->

We're going to add a REST route to our API that increments the count of
likes for a specific quote: `/quotes/:id/like`

First let's add [fluent-json-schema](https://www.npmjs.com/package/fluent-json-schema) as a dependency for our API:

```bash
npm install fluent-json-schema
```

We'll use `fluent-json-schema` to help us generate a JSON Schema. We can then
use this schema to validate the request path parameters for our route (`id`).

:::tip
You can use [fastify-type-provider-typebox](https://github.com/fastify/fastify-type-provider-typebox) or [typebox](https://github.com/sinclairzx81/typebox) if you want to convert your JSON Schema into a Typescript type. See [this GitHub thread](https://github.com/fastify/fluent-json-schema/issues/78#issuecomment-669059113) to have a better overview about it. Look at the example below to have a better overview.
:::

Here you can see in practice of to leverage `typebox` combined with `fastify-type-provider-typebox`:
```typescript
import { FastifyInstance } from "fastify";
import { Static, Type } from "@sinclair/typebox";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

/**
 * Creation of the JSON schema needed to validate the params passed to the route
 */
const schemaParams = Type.Object({
  num1: Type.Number(),
  num2: Type.Number(),
});

/**
 * We convert the JSON schema to the TypeScript type, in this case:
 * {
    num1: number;
    num2: number;
  }
 */
type Params = Static<typeof schemaParams>;

/**
 * Here we can pass the type previously created to our syncronous unit function
 */
const multiplication = ({ num1, num2 }: Params) => num1 * num2;

export default async function (app: FastifyInstance) {
  app.withTypeProvider<TypeBoxTypeProvider>().get(
    "/multiplication/:num1/:num2",
    { schema: { params: schemaParams } },
    /**
     * Since we leverage `withTypeProvider<TypeBoxTypeProvider>()`,
     * we no longer need to explicitly define the `params`.
     * The will be automatically inferred as:
     *  {
          num1: number;
          num2: number;
        }
     */
    ({ params }) => multiplication(params)
  );
}
```

Now let's add our REST API route in **`plugin.js`**:

```javascript
'use strict'

// highlight-next-line
const S = require('fluent-json-schema')

module.exports = async function plugin (app) {
  app.log.info('plugin loaded')

  // This JSON Schema will validate the request path parameters.
  // It reuses part of the schema that Platormatic DB has
  // automatically generated for our Quote entity.
// highlight-start
  const schema = {
    params: S.object().prop('id', app.getSchema('Quote').properties.id)
  }

  app.post('/quotes/:id/like', { schema }, async function (request, response) {
    return {}
  })
// highlight-end
}
```

We can now make a `POST` request to our new API route:

```bash
curl --request POST http://localhost:3042/quotes/1/like
```

:::info
Learn more about how validation works in the
[Fastify validation documentation](https://www.fastify.io/docs/latest/Reference/Validation-and-Serialization/).
:::

Our API route is currently returning an empty object (`{}`). Let's wire things
up so that it increments the number of likes for the quote with the specified ID.
To do this we'll add a new function inside of our plugin:

```javascript
module.exports = async function plugin (app) {
  app.log.info('plugin loaded')

// highlight-start
  async function incrementQuoteLikes (id) {
    const { db, sql } = app.platformatic

    const result = await db.query(sql`
      UPDATE quotes SET likes = likes + 1 WHERE id=${id} RETURNING likes
    `)

    return result[0]?.likes
  }
// highlight-end

  // ...
}
```

And then we'll call that function in our route handler function:

```javascript
app.post('/quotes/:id/like', { schema }, async function (request, response) {
// highlight-next-line
  return { likes: await incrementQuoteLikes(request.params.id) }
})
```

Now when we make a `POST` request to our API route:

```bash
curl --request POST http://localhost:3042/quotes/1/like
```

We should see that the `likes` value for the quote is incremented every time
we make a request to the route.

```json
{"likes":1}
```

<!-- TODO: Are custom REST routes added into the OpenAPI docs? -->

### Add a GraphQL API mutation

We can add a `likeQuote` mutation to our GraphQL API by reusing the
`incrementQuoteLikes` function that we just created.

Let's add this code at the end of our plugin, inside **`plugin.js`**:

```javascript
module.exports = async function plugin (app) {
  // ...

// highlight-start
  app.graphql.extendSchema(`
    extend type Mutation {
      likeQuote(id: ID!): Int
    }
  `)

  app.graphql.defineResolvers({
    Mutation: {
      likeQuote: async (_, { id }) => await incrementQuoteLikes(id)
    }
  })
// highlight-end
}
```

The code we've just added extends our API's GraphQL schema and defines
a corresponding resolver for the `likeQuote` mutation.

We can now load up GraphiQL in our web browser and try out our new `likeQuote`
mutation with this GraphQL query:

```graphql
mutation {
  likeQuote(id: 1)
}
```

:::info
Learn more about how to extend the GraphQL schema and define resolvers in the
[Mercurius API documentation](https://mercurius.dev/#/docs/api/options).
:::

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
**`platformatic.db.json`**:

```json
{
  "server": {
    "logger": {
      "level": "{PLT_SERVER_LOGGER_LEVEL}"
    },
    "hostname": "{PLT_SERVER_HOSTNAME}",
    "port": "{PORT}",
// highlight-start
    "cors": {
      "origin": "{PLT_SERVER_CORS_ORIGIN}"
    }
// highlight-end
  },
  ...
}
```

The HTTP responses from all endpoints on our API will now include the header:

```
access-control-allow-origin: http://localhost:3000
```

This will allow JavaScript running on web pages under the `http://localhost:3000`
origin to make requests to our API.

## Wrapping up

And we're done — you now have the knowledge you need to build a complete application on top of Platformatic DB.

We can't wait to see what you'll build next!