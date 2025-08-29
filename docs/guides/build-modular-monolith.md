# Build and deploy a modular monolith

## Introduction

In this guide we'll create a "modular monolith" Library application. It will be a Platformatic Runtime app which contains multiple Platformatic DB and Gateway applications. We'll learn how to:

- Create and configure a [Platformatic Runtime](https://docs.platformatic.dev/docs/reference/runtime/introduction) app with multiple applications
  - Three [Platformatic DB](https://docs.platformatic.dev/docs/reference/db/introduction) applications, each with their own databases
  - A [Platformatic Gateway](https://docs.platformatic.dev/docs/reference/gateway/introduction) application which aggregates multiple application's REST APIs into a composed API
- Customise the composed API that's automatically generated in a Gateway application
- Generate a client for an application's REST API and use it in a Platformatic application to make API requests
- Add custom functionality to a Gateway application's composed API by modifying its routes and responses

The architecture for our Library application will look like this:

<!-- SCREENSHOT: architecture-diagram.png -->
![Library app architecture diagram](./build-modular-monolith-images/architecture-diagram.png)

The complete code for this tutorial is [available on GitHub](https://github.com/platformatic/examples/tree/main/applications/build-modular-monolith-with-platformatic).

### Prerequisites

To follow along with this tutorial, you'll need to have this software installed:

- [Node.js](https://nodejs.org/?utm_campaign=Build%20and%20deploy%20a%20modular%20monolith%20with%20Platformatic&utm_medium=blog&utm_source=Platformatic%20Blog) >= v20.16.0
- [npm](https://docs.npmjs.com/cli/?utm_campaign=Build%20and%20deploy%20a%20modular%20monolith%20with%20Platformatic&utm_medium=blog&utm_source=Platformatic%20Blog) v7 or later
- A code editor, for example [Visual Studio Code](https://code.visualstudio.com/?utm_campaign=Build%20and%20deploy%20a%20modular%20monolith%20with%20Platformatic&utm_medium=blog&utm_source=Platformatic%20Blog).

## Create a Platformatic Runtime app: Library app

We're going to start by creating our Library app. This will be a Platformatic Runtime app that contains all of our applications.

First, let's run the Watt creator wizard in our terminal:

```bash
npm create wattpm
```

And then let's enter the following settings:

```
? Where would you like to create your project? library-app
? Which kind of application do you want to create? @platformatic/db
? What is the name of the application? people-application
? What is the connection string? sqlite://./db.sqlite
? Do you want to create default migrations? no
? Do you want to create another application? no
? Do you want to use TypeScript? no
? What port do you want to use? 3042
```

After answering these questions, the creator will create all the files for the `people-application`. 

Once the creator has finished, our `library-app` directory should look like this:

```
library-app/
├── README.md
├── package.json
├── platformatic.runtime.json
└── web
    └── people-application
        ├── README.md
        ├── migrations
        ├── package.json
        └── platformatic.json
```

## Start the Library app

Let's change into the directory that contains our Library app:

```bash
cd library-app
```

And then we can start the app with:

```bash
npm start
```

We'll see a warning message displayed like this in our terminal:

```
[17:56:00.807] WARN (people-service/8615): No tables found in the database. Are you connected to the right database? Did you forget to run your migrations? This guide can help with debugging Platformatic DB: https://docs.platformatic.dev/docs/guides/debug-platformatic-db
```

<!-- SCREENSHOT: start-the-runtime-app-01.png -->
![Start the Runtime app - 01](./build-modular-monolith-images/start-the-runtime-app-01.png)

If we open up the API documentation for our People application at http://127.0.0.1:3042/documentation/ we will just see the `/example` route.

We're seeing these messages because we haven't yet defined a schema for our People database. To fix this, let's go ahead and configure our People application.

## Configure the People application

To help us get our People application up and running, we're now going to do the following things:

- **Create the People database schema** — We'll create an SQL migration that adds the schema for our People database, and then apply it to our database using the Platformatic CLI. When we start our People application, Platformatic DB will automatically generate REST and GraphQL APIs based on our database schema (we'll only be working with the REST one in this tutorial).
- **Populate the People database** — We'll create a script that can add preset data into our database, and then use the Platformatic CLI to run it. This is commonly referred to as "seeding" the database.
- **Test the People application** — We'll explore the API documentation for our People application, and then make an HTTP request to one of the REST API routes. This will help us verify that our People database has the correct schema and contains the data that we seeded it with.

### Create the People database schema

First, let's create `web/people-application/migrations/001.do.sql` with the following SQL contents:

```sql
# web/people-application/migrations/001.do.sql

CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Then, let's create `web/people-application/migrations/001.undo.sql` with the following SQL contents:

```sql
# web/people-application/migrations/001.undo.sql

DROP TABLE people;
```

Now in another terminal, let's change into the `people-application` directory:

```bash
cd web/people-application
```

And apply our migration:

```bash
npx wattpm people-application:migrations:apply
```

### Populate the People database

Let's create a new file, `web/people-application/seed.js`, and add this code to it:

```javascript
// web/people-application/seed.js

'use strict'

const people = [
  'Stephen King',
  'Miranda July',
  'Lewis Carroll',
  'Martha Schumacher',
  'Mick Garris',
  'Dede Gardner'
]

module.exports = async function ({ entities, logger }) {
  for (const name of people) {
    const newPerson = await entities.person.save({ input: { name } })

    logger.info({ newPerson }, 'Created person')
  }
}
```

Now let's populate the database

```bash
npx wattpm people-application:seed seed.js
```

We should see output like this from our seed script:

```
[18:06:05] INFO: seeding from seed.js
Created person: {
  id: '1',
  name: 'Stephen King',
  createdAt: 1687827965773,
  updatedAt: 1687827965773
}
Created person: {
  id: '2',
  name: 'Miranda July',
  createdAt: 1687827965778,
  updatedAt: 1687827965778
}

...

[18:06:05] INFO: seeding complete
```

> You can learn more about seeding the database for a Platformatic DB app [in this guide](https://docs.platformatic.dev/docs/guides/seed-a-database?utm_campaign=Build%20and%20deploy%20a%20modular%20monolith%20with%20Platformatic&utm_medium=blog&utm_source=Platformatic%20Blog).

### Test the People application

Let's refresh the API documentation page for our People application (http://127.0.0.1:3042/documentation/). We should now see all the `/people` API routes that Platformatic DB has automatically generated based on our database schema.

<!-- SCREENSHOT: test-the-people-service-01.png -->
![Test the People application - 01](./build-modular-monolith-images/test-the-people-service-01.png)

Now we can test our People application API by making a request to it with cURL:

```bash
curl localhost:3042/people/
```

We should receive a response like this:

```json
[{"id":1,"name":"Stephen King","createdAt":"1687827965773","updatedAt":"1687827965773"},{"id":2,"name":"Miranda July","createdAt":"1687827965778","updatedAt":"1687827965778"},{"id":3,"name":"Lewis Carroll","createdAt":"1687827965780","updatedAt":"1687827965780"},{"id":4,"name":"Martha Schumacher","createdAt":"1687827965782","updatedAt":"1687827965782"},{"id":5,"name":"Mick Garris","createdAt":"1687827965784","updatedAt":"1687827965784"},{"id":6,"name":"Dede Gardner","createdAt":"1687827965786","updatedAt":"1687827965786"}]
```

## Create a Platformatic DB application: Books application

We're now going to create a Books application. We'll follow a similar process to the one that we just used to set up our People application.

In the root directory of our Runtime project (`library-app`), let's run this command to create the new application:

```bash
npm create wattpm
```

And then let's enter the following settings:

```
? Which kind of application do you want to create? @platformatic/db
? What is the name of the application? books-application
? What is the connection string? sqlite://./db.sqlite
? Do you want to create default migrations? no
? Do you want to create another application? no
? Which application should be exposed? books-application
? Do you want to use TypeScript? no
```

Once the command has finished running, we should see that a Platformatic DB application has been created for us in the `web/books-application/` directory.

### Create the Books database schema

Now we're going to create a migration that adds the schema for our Books database.

First, let's create `web/books-application/migrations/001.do.sql` with the following SQL contents:

```sql
# web/books-application/migrations/001.do.sql

CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  author_id INTEGER NOT NULL,
  published_year INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Then, let's create `web/books-application/migrations/001.undo.sql` with the following SQL contents:

```sql
# web/books-application/migrations/001.undo.sql

DROP TABLE books;
```

Now we'll change into the `books-application` directory:

```bash
cd web/books-application
```

And apply our migration:

```bash
npx wattpm books-application:migrations:apply
```

### Populate the Books database

Let's create a new file, `web/books-application/seed.js`, and add this code to it:

```javascript
// web/books-application/seed.js

'use strict'

const books = [
  {
    title: 'Fairy Tale',
    authorId: 1, // Stephen King
    publishedYear: '2022'
  },
  {
    title: 'No One Belongs Here More Than You',
    authorId: 2, // Miranda July
    publishedYear: 2007
  },
  {
    title: 'Alice\'s Adventures in Wonderland',
    authorId: 3, // Lewis Carroll
    publishedYear: 1865
  }
]

module.exports = async function ({ entities, logger }) {
  for (const book of books) {
    const newBook = await entities.book.save({ input: book })

    logger.info({ newBook }, 'Created book')
  }
}
```


Now let's populate the database

```bash
npx wattpm books-application:seed seed.js
```

We should see output like this from our seed script:

```
[12:13:31] INFO: seeding from seed.js
Created book: {
  id: '1',
  title: 'Fairy Tale',
  authorId: 1,
  publishedYear: 2022,
  createdAt: 1687893211326,
  updatedAt: 1687893211326
}

...

[12:13:31] INFO: seeding complete
```

### Test the Books application API

To publicly expose the Books application so that we can test it, we need to change the `entrypoint` in `watt.json` to `books-application` (if you follow the settings above, you will not have to change anything):

```json
// watt.json

{
  ...
  "entrypoint": "books-application",
  ...
}
```

In the terminal where we have our Library app running, let's stop it by pressing `CTRL+C`. Then let's start it again with:

```bash
npm start
```

Now we can test our Books application API by making a request to it:

```bash
curl localhost:3042/books/
```

The response should look like this:

```json
[{"id":1,"title":"Fairy Tale","authorId":1,"publishedYear":2022,"createdAt":"1687893211326","updatedAt":"1687893211326"},{"id":2,"title":"No One Belongs Here More Than You","authorId":2,"publishedYear":2007,"createdAt":"1687893211333","updatedAt":"1687893211333"},{"id":3,"title":"Alice's Adventures in Wonderland","authorId":3,"publishedYear":1865,"createdAt":"1687893211336","updatedAt":"1687893211336"}]
```

If we open up the API documentation for our Books application at http://127.0.0.1:3042/documentation/, we can see all of its routes:

<!-- SCREENSHOT: test-the-books-service-api-01.png -->
![Test the Books Application API 01](./build-modular-monolith-images/test-the-books-service-api-01.png)

## Create a Platformatic DB application: Movies application

We're now going to create our third and final Platformatic DB application: the Movies application.

In the root directory of our Runtime project (`library-app`), let's create the new application:

```bash
npm create wattpm
```

And then let's enter the following settings:

```bash
? Which kind of application do you want to create? @platformatic/db
? What is the name of the application? movies-application
? What is the connection string? sqlite://./db.sqlite
? Do you want to create default migrations? no
? Do you want to create another application? no
? Do you want to use TypeScript? no
```

Similarly to before, once the command has finished running, we should see that a Platformatic DB application has been created for us in the `web/movies-application/` directory.

### Create the Movies database schema

Lets create a migration to add the schema for our Movies database.

First, let's create `web/movies-application/migrations/001.do.sql` with the following SQL contents:

```sql
# web/movies-application/migrations/001.do.sql

CREATE TABLE IF NOT EXISTS movies (
  id INTEGER PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  director_id INTEGER NOT NULL,
  producer_id INTEGER NOT NULL,
  released_year INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Then, let's create `web/movies-application/migrations/001.undo.sql` with the following SQL contents:

```sql
# web/movies-application/migrations/001.undo.sql

DROP TABLE movies;
```

Now we'll change into the `movies-application` directory:

```bash
cd web/movies-application
```

And apply our migration:

```bash
npx wattpm movies-application:migrations:apply
```

### Populate the Movies database

Let's create a new file, `web/movies-application/seed.js`, and add this code to it:

```javascript
// web/movies-application/seed.js

'use strict'

const movies = [
  {
    title: 'Maximum Overdrive',
    directorId: 1, // Stephen King
    producerId: 4, // Martha Schumacher
    releasedYear: 1986
  },
  {
    title: 'The Shining',
    directorId: 5, // Mick Garris
    producerId: 1, // Stephen King
    releasedYear: 1980
  },
  {
    title: 'Kajillionaire',
    directorId: 2, // Miranda July
    producerId: 6, // Dede Gardner
    releasedYear: 2020
  }
]

module.exports = async function ({ entities, logger }) {
  for (const movie of movies) {
    const newmovie = await entities.movie.save({ input: movie })

    logger.info({ newmovie }, 'Created movie')
  }
}
```


Now let's populate the database

```bash
npx wattpm movies-application:seed seed.js
```

We should see output like this from our script:

```
[12:43:24] INFO: seeding from seed.js
Created movie: {
  id: '1',
  title: 'Maximum Overdrive',
  directorId: 1,
  producerId: 4,
  releasedYear: 1986,
  createdAt: 1687895004362,
  updatedAt: 1687895004362
}

...

[12:43:24] INFO: seeding complete
```

### Test the Movies application API

To publicly expose the Movies application so that we can test it, we need to change the `entrypoint` in `watt.json` to `movies-application`:

```json
// watt.json

{
  ...
  "entrypoint": "movies-application",
  ...
}
```

And then let's stop our Library app running by pressing `CTRL+C`, and start it again with:

```bash
npm start
```

We can now test our Movies application API by making a request to it:

```bash
curl localhost:3042/movies/
```

And we should then receive a response like this:

```json
[{"id":1,"title":"Maximum Overdrive","directorId":1,"producerId":4,"releasedYear":1986,"createdAt":"1687895004362","updatedAt":"1687895004362"},{"id":2,"title":"The Shining","directorId":5,"producerId":1,"releasedYear":1980,"createdAt":"1687895004369","updatedAt":"1687895004369"},{"id":3,"title":"Kajillionaire","directorId":2,"producerId":6,"releasedYear":2020,"createdAt":"1687895004372","updatedAt":"1687895004372"}]
```

If we open up the Swagger UI documentation at http://127.0.0.1:3042/documentation/, we can see all of our Movie application's API routes:

<!-- SCREENSHOT: test-the-movies-service-api-01.png -->
![Test the Movies application API - 01](./build-modular-monolith-images/test-the-movies-service-api-01.png)

## Create a Gateway application: Media application

We're now going to use Platformatic Gateway to create a Media application. This application will compose the `books-application` and `movies-application` APIs into a single REST API.

In the root directory of our Runtime project (`library-app`), let's create the Media application by running:

```bash
npm create wattpm
```

And then let's enter the following settings:

``` bash
? Which kind of application do you want to create? @platformatic/gateway
? What is the name of the application? media-application
? Do you want to create another application? no
? Do you want to use TypeScript? no
```

Once the command has finished, we'll see that our Platformatic Gateway application has been created in the `web/media-application` directory.

### Configure the composed applications

We're now going to replace the example `services` configuration for our Media application, and configure it to compose the APIs for our Books and Movies applications.

Let's open up `web/media-application/platformatic.json` and replace the `services` array so that it looks like this:

```json
// web/media-application/platformatic.json

{
  "$schema": "https://schemas.platformatic.dev/@platformatic/gateway/2.64.0.json",
  ...,
  "gateway": {
    "services": [
      {
        "id": "books-application",
        "openapi": {
          "url": "/documentation/json"
        }
      },
      {
        "id": "movies-application",
        "openapi": {
          "url": "/documentation/json"
        }
      }
    ],
    "refreshTimeout": 1000
  },
  ...
}
```

Let's take a look at the settings we've added here:

- `gateway.services[].id` — The `id` values are the identifiers for our Books and Movies applications. These are derived from the applications' directory names.
- `gateway.services[].openapi.url` — This is the URL that Gateway will automatically call to retrieve the application's OpenAPI schema. It will use the OpenAPI schema to build the routes in our Media application's composed API.
- `gateway.refreshTimeout` — This configures Gateway to retrieve the OpenAPI schema for each application every 1 second (1000 milliseconds = 1 second). This is a good value during development, but should be longer in production. If Gateway detects that the OpenAPI schema for an application has changed, it will rebuild the composed API.

### Test the composed Media application API

To expose our Media application, we need to change the `entrypoint` in `watt.json` to `media-application`:

```json
// watt.json

{
  ...
  "entrypoint": "media-application",
  ...
}
```

And then stop (`CTRL+C`) and start our Library app:

```bash
npm start
```

Now let's open up the Media application's API documentation at http://127.0.0.1:3042/documentation/. Here we can see that our Media application is composing all of our Books and Movie applications' API routes into a single REST API:

<!-- SCREENSHOT: test-the-composed-media-service-api-01.png -->
![Test the Composed Media Application API - 01](./build-modular-monolith-images/test-the-composed-media-service-api-01.png)

Now let's test our composed Media application API by making a request to retrieve books:

```bash
curl localhost:3042/books/
```

We should receive a response like this:

```json
[{"id":1,"title":"Fairy Tale","authorId":1,"publishedYear":2022,"createdAt":"1687893211326","updatedAt":"1687893211326"},{"id":2,"title":"No One Belongs Here More Than You","authorId":2,"publishedYear":2007,"createdAt":"1687893211333","updatedAt":"1687893211333"},{"id":3,"title":"Alice's Adventures in Wonderland","authorId":3,"publishedYear":1865,"createdAt":"1687893211336","updatedAt":"1687893211336"}]
```

And then we can make a request to retrieve movies through the Media application API:

```bash
curl localhost:3042/movies/
```

We should receive a response like this:

```json
[{"id":1,"title":"Maximum Overdrive","directorId":1,"producerId":4,"releasedYear":1986,"createdAt":"1687895004362","updatedAt":"1687895004362"},{"id":2,"title":"The Shining","directorId":5,"producerId":1,"releasedYear":1980,"createdAt":"1687895004369","updatedAt":"1687895004369"},{"id":3,"title":"Kajillionaire","directorId":2,"producerId":6,"releasedYear":2020,"createdAt":"1687895004372","updatedAt":"1687895004372"}]
```

> If Gateway has already generated a composed API, but later is unable to retrieve the OpenAPI schema for a service, it will remove the routes for that service from the composed API. Those routes will then return a 404 error response.

### Make the composed Media application API read-only

Platformatic Gateway allows us to customise the composed API that it generates for us. We can do this by creating an OpenAPI configuration file for each application, and then configuring our Gateway application to load it.

Our Books and Movies databases are already populated with data, and we don't want anyone to be able to add to, edit or delete that data. We're now going to configure the Media application to ignore `POST`, `PUT` and `DELETE` routes for the Books and Movies APIs. This will effectively make our Media application's composed API read-only.

First, let's create a new file, `web/media-application/books-application-openapi.config.json`, and add in this JSON:

```json
// web/media-application/books-application-openapi.config.json

{
  "paths": {
    "/books/": {
      "post": { "ignore": true },
      "put": { "ignore": true },
      "delete": { "ignore": true }
    },
    "/books/{id}": {
      "post": { "ignore": true },
      "put": { "ignore": true },
      "delete": { "ignore": true }
    }
  }
}
```

Then let's create another file, `web/media-application/movies-application-openapi.config.json`, and add in this JSON:

```json
// web/media-application/movies-application-openapi.config.json

{
  "paths": {
    "/movies/": {
      "post": { "ignore": true },
      "put": { "ignore": true },
      "delete": { "ignore": true }
    },
    "/movies/{id}": {
      "post": { "ignore": true },
      "put": { "ignore": true },
      "delete": { "ignore": true }
    }
  }
}
```

Now let's open up `web/media-application/platformatic.json` and configure the Media application to apply these application configurations to our composed API:

```diff
// web/media-application/platformatic.json

  {
    ...,
    "gateway": {
      "services": [
        {
          "id": "books-application",
          "openapi": {
-           "url": "/documentation/json"
+           "url": "/documentation/json",
+           "config": "books-application-openapi.config.json"
          }
        },
        {
          "id": "movies-application",
          "openapi": {
-           "url": "/documentation/json"
+           "url": "/documentation/json",
+           "config": "movies-application-openapi.config.json"
          }
        }
      ],
      "refreshTimeout": 1000
    },
    ...
  }
```

If we open up the API documentation for our Media application at http://127.0.0.1:3042/documentation/, we should now see that only the composed `GET` routes are available:

<!-- SCREENSHOT: make-the-composed-media-service-api-read-only-01.png -->
![Make the Composed Media Application API Read Only - 01](./build-modular-monolith-images/make-the-composed-media-service-api-read-only-01.png)

> As well as allowing us to ignore specific routes, Platformatic Gateway also supports aliasing for route paths and the renaming of route response fields. See the [Gateway OpenAPI](https://docs.platformatic.dev/docs/reference/gateway/configuration?utm_campaign=Build%20and%20deploy%20a%20modular%20monolith%20with%20Platformatic&utm_medium=blog&utm_source=Platformatic%20Blog#openapi-configuration) documentation to learn more.

### Add People data to Media application responses

Our Books and Movies applications currently send responses containing IDs that relate to people in the People database, but those responses don't contain the names of those people. We're now going to create a client for the People application, and then create a plugin for our Media application that uses it to enrich the Books and Movies application responses with people's names. The responses from the `/books/` and `/movies/` routes in our Media application's composed API will then contain IDs _and_ names for the people that each resource relates to.

First, let's change into the directory for our Media application:

```bash
cd web/media-application/
```

And then let's install [`@platformatic/client`](https://www.npmjs.com/package/@platformatic/client?utm_campaign=Build%20and%20deploy%20a%20modular%20monolith%20with%20Platformatic&utm_medium=blog&utm_source=Platformatic%20Blog) as a dependency:

```bash
npm install @platformatic/client
```

Now we can generate a client for the People application:

```bash
npx --package @platformatic/client-cli plt-client --name people --runtime people-application --folder clients/people/
```

We'll see that this has generated a new directory, `clients/people/`, which contains a snapshot of the People application's OpenAPI schema and types that we can use when we integrate the client with our Media application. If we open up `platformatic.json`, we'll also see that a `clients` block like this has been added:

```json
// web/media-application/platformatic.json

{
  "$schema": "https://schemas.platformatic.dev/@platformatic/gateway/1.52.0.json",
  ...,
  "clients": [
    {
      "schema": "clients/people/people.openapi.json",
      "name": "people",
      "type": "openapi",
      "serviceId": "people-application"
    }
  ],
  ...
}
```

This configuration will make the People application client available as `app.people` inside any plugins that we create for our Media application.

To create the skeleton structure for our plugin, let's create a new file, `web/media-application/plugin.js`, and add the following code:

```javascript
// web/media-application/plugin.js

'use strict'

const { buildOpenAPIClient } = require("@platformatic/client");
const { resolve } = require("node:path");

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function peopleDataPlugin (app) {
  const client = await buildOpenAPIClient({
    url: "http://people-application.plt.local",
    path: resolve(__dirname, "clients/people/people.openapi.json"),
  });
}
```

The code we've just added is the skeleton structure for our plugin. A `@platformatic/client` is instantiated out of the OpenAPI specification.

To be able to modify the responses that are sent from one of our Media application's composed API routes, we need to add a Gateway `onRoute` hook for the route, and then set an `onGatewayResponse` callback function inside it, for example:

```javascript
app.platformatic.addGatewayOnRouteHook('/books/', ['GET'], function (routeOptions) {
  routeOptions.config.onGatewayResponse = function (request, reply, body) {
    // ...
  }
})
```

With the code above, when Gateway registers the `GET` route for `/books/` in the composed API, it will call the `onRoute` hook function. Then when the Media application receives a response for that route from the downstream application, it will run our `onGatewayResponse` callback function. We can add code inside the `onGatewayResponse` which modifies the response that is returned back to the client that made the original request.

> To get a clearer picture of how this works, take a look at our [Gateway API modification](https://docs.platformatic.dev/docs/reference/gateway/api-modification/?utm_campaign=Build%20and%20deploy%20a%20modular%20monolith%20with%20Platformatic&utm_medium=blog&utm_source=Platformatic%20Blog) documentation.

Let's now apply what we've just learnt about Gateway hooks and callbacks. First, let's add the following code inside the `peopleDataPlugin` function in `web/media-application/plugin.js`:

```javascript
// web/media-application/plugin.js

function buildOnGatewayResponseCallback (peopleProps) {
  return async function addPeopleToResponse (request, reply, body) {
    let entities = await body.json()

    const multipleEntities = Array.isArray(entities)
    if (!multipleEntities) {
      entities = [entities]
    }

    const peopleIds = []
    for (const entity of entities) {
      for (const { idProp } of peopleProps) {
        peopleIds.push(entity[idProp])
      }
    }

    const people = await client.getPeople({ "where.id.in": peopleIds.join(',') })

    const getPersonNameById = (id) => {
      const person = people.find(person => person.id === id)
      return (person) ? person.name : null
    }

    for (let entity of entities) {
      for (const { idProp, nameProp } of peopleProps) {
        entity[nameProp] = getPersonNameById(entity[idProp])
      }
    }

    reply.send(multipleEntities ? entities : entities[0])
  }
}
```

There are a few moving parts in the code above, so let's break down what's happening. The `buildOnGatewayResponseCallback` function returns a function, which when called will:

- Parse the JSON response body
- Handle single or multiple entities
- Extract the person IDs from the properties in the entities that contain them
- Use the People client to retrieve people matching those IDs from the People service
- Loop through each entity and adds new properties with the names for any people referenced by that entity

Now, let's add this function after the `buildOnGatewayResponseCallback` function:

```javascript
// web/media-application/plugin.js

function booksOnRouteHook (routeOptions) {
  const responseSchema = routeOptions.schema.response[200]
  const entitySchema = (responseSchema.items) ? responseSchema.items : responseSchema
  entitySchema.properties.authorName = { type: 'string' }
  entitySchema.required ??= []
  entitySchema.required.push('authorName')

  routeOptions.config.onGatewayResponse = buildOnGatewayResponseCallback([
    { idProp: 'authorId', nameProp: 'authorName' }
  ])
}
```

In the code above we're modifying the response schema for the route which the `routeOptions` have been passed for. This ensures that the `authorName` will be correctly serialized in the response from our Media application's `/books/` routes.

Then, we're registering an `onGatewayResponse` callback, which is the function that's returned by the `buildOnGatewayResponseCallback` that we added a little earlier. The `peopleProps` array that we're passing to `buildOnGatewayResponseCallback` tells it to look for a person ID in the `authorId` property for any book entity, and then to set the name that it retrieves for the person matching that ID to a property named `authorName`.

Finally, let's add this code after the `booksOnRouteHook` function to wire everything up:

```javascript
app.platformatic.addGatewayOnRouteHook('/books/', ['GET'], booksOnRouteHook)
app.platformatic.addGatewayOnRouteHook('/books/{id}', ['GET'], booksOnRouteHook)
```

Now we can configure the Media application to load our new plugin. Let's open up `platformatic.json` and add a `plugins` object to the application configuration:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/gateway/1.52.0.json",
  ...,
  "plugins": {
    "paths": [
      "./plugin.js"
    ]
  }
}
```

Now let's test our `/books/` routes to see if the people data is being added to the responses:

```bash
curl localhost:3042/books/ | grep 'authorName'
```

We should see that each book in the JSON response now contains an `authorName`.

If we make a request to retrieve the book with the ID `1`, we should see that response also now contains an `authorName`:

```bash
curl localhost:3042/books/1 | grep 'authorName'
```

We're now going to add `onRoute` hooks for our composed `/movies/` routes. These hooks will add the names for the director and producer of each movie.

First, let's add this function inside the `peopleDataPlugin`, after the other code that's already there:

```javascript
// web/media-application/plugin.js

function moviesOnRouteHook (routeOptions) {
  const responseSchema = routeOptions.schema.response[200]
  const entitySchema = (responseSchema.items) ? responseSchema.items : responseSchema
  entitySchema.properties.directorName = { type: 'string' }
  entitySchema.properties.producerName = { type: 'string' }
  entitySchema.required ??= []
  entitySchema.required.push('directorName', 'producerName')

  routeOptions.config.onGatewayResponse = buildOnGatewayResponseCallback([
    { idProp: 'directorId', nameProp: 'directorName' },
    { idProp: 'producerId', nameProp: 'producerName' }
  ])
}
```

Similarly to the `booksOnRouteHook` function, the code above is modifying the response schema for the `/movies/` routes to allow for two new properties: `directorName` and `producerName`. It's then registering an `onGatewayResponse` callback. That callback will pluck person IDs from the `directorId` and `producerId` properties in any movie entity, and then set the names for the corresponding people in the `directorName` and `producerName` properties.

Finally, let's wire up the `moviesOnRouteHook` to our `/movies/` routes:

```javascript
// web/media-application/plugin.js

app.platformatic.addGatewayOnRouteHook('/movies/', ['GET'], moviesOnRouteHook)
app.platformatic.addGatewayOnRouteHook('/movies/{id}', ['GET'], moviesOnRouteHook)
```

Now we can test our `/movies/` routes to confirm that the people data is being added to the responses:

```bash
curl localhost:3042/movies/ | grep 'Name'
```

Each movie in the JSON response should now contains a `directorName` and a `producerName`.

If we make a request to retrieve the movie with the ID `3`, we should see that response also now contains a `directorName` and a `producerName`:

```bash
curl localhost:3042/movies/3 | grep 'Name'
```

### Configure a service proxy to debug the People application API

Our Media application is composing the Books and Movies applications into an API, and the Media application is then exposed by the Library app. But what if we want to test or debug the People application API during development? Fortunately, Platformatic Gateway provides a service proxy feature ([`services[].proxy`](https://docs.platformatic.dev/docs/reference/gateway/configuration#gateway)) which we can use to help us do this.

Let's try this out by adding another service to the `services` in `platformatic.json`:

```diff
// platformatic.json

  {
    "$schema": "https://schemas.platformatic.dev/@platformatic/gateway/1.52.0.json",
    ...,
    "gateway": {
      "services": [
        ...,
        {
          "id": "movies-application",
          "openapi": {
            "url": "/documentation/json",
            "config": "movies-application-openapi.config.json"
          }
-       }
+       },
+       {
+         "id": "people-application",
+         "proxy": {
+           "prefix": "people-application"
+         }
+       }
      ],
      "refreshTimeout": 1000
    },
    ...
  }
```

Now the People application API will be made available as part of the composed Media application API under the prefix `/people-application/`.

Let's test it now by making a request to one of the People application routes, via the composed Media application API:

```bash
curl localhost:3042/people-application/people/
```

We should receive a response like this from the People application's `/people` route:

```json
[{"id":1,"name":"Stephen King","createdAt":"1687891503369","updatedAt":"1687891503369"},{"id":2,"name":"Miranda July","createdAt":"1687891503375","updatedAt":"1687891503375"},{"id":3,"name":"Lewis Carroll","createdAt":"1687891503377","updatedAt":"1687891503377"},{"id":4,"name":"Martha Schumacher","createdAt":"1687891503379","updatedAt":"1687891503379"},{"id":5,"name":"Mick Garris","createdAt":"1687891503381","updatedAt":"1687891503381"},{"id":6,"name":"Dede Gardner","createdAt":"1687891503383","updatedAt":"1687891503383"}]
```

Although the Gateway service proxy is a helpful feature, we don't want to use this in production, so let's remove the configuration that we just added to `platformatic.json`:

```diff
// platformatic.json

  {
    "$schema": "https://schemas.platformatic.dev/@platformatic/gateway/1.52.0.json",
    ...,
    "gateway": {
      "services": [
        ...,
        {
          "id": "movies-application",
          "openapi": {
            "url": "/documentation/json",
            "config": "movies-application-openapi.config.json"
          }
+       }
-       },
-       {
-         "id": "people-application",
-         "proxy": {
-           "prefix": "people-application"
-         }
-       }
      ],
      "refreshTimeout": 1000
    },
    ...
  }
```

## Next steps

### Integrating existing services into a Runtime application

If you have existing services that aren't built with Platformatic or Fastify, there are two ways you can integrate them with the applications in a Platformatic Runtime application:

1. If the existing service provides an OpenAPI schema (via a URL or a file), you can create a Platformatic Gateway application inside the Runtime application and configure it to add the API for the existing service into a composed API.
2. If the existing service provides an OpenAPI or GraphQL schema, you can generate a Platformatic Client for the existing service. The generated client can then be integrated with one of the Runtime applications.

### Building Platformatic Runtime applications in a monorepo

Here at Platformatic we use a [pnpm](https://pnpm.io/?utm_campaign=Build%20and%20deploy%20a%20modular%20monolith%20with%20Platformatic&utm_medium=blog&utm_source=Platformatic%20Blog) workspace to manage our [platformatic](https://github.com/platformatic/platformatic/?utm_campaign=Build%20and%20deploy%20a%20modular%20monolith%20with%20Platformatic&utm_medium=blog&utm_source=Platformatic%20Blog) monorepo. If you want to build Platformatic Runtime applications in a monorepo, you might want to take a look at [pnpm workspaces](https://pnpm.io/workspaces?utm_campaign=Build%20and%20deploy%20a%20modular%20monolith%20with%20Platformatic&utm_medium=blog&utm_source=Platformatic%20Blog) for managing your repository.

You can configure your Runtime applications as pnpm workspaces by adding a `pnpm-workspace.yaml` file to your project like this:

```yaml
packages:
  - 'web/*'
```

This allows you to then run scripts for all applications, for example `pnpm run -r migrate`. See the [example application README](https://github.com/platformatic/examples/tree/main/applications/build-modular-monolith-with-platformatic?utm_campaign=Build%20and%20deploy%20a%20modular%20monolith%20with%20Platformatic&utm_medium=blog&utm_source=Platformatic%20Blog#readme) for more details.

## Wrapping up

If you've followed this tutorial step-by-step, you should now have a Platformatic Runtime app with four separate applications that work together to provide a unified API. You can find the full application code [on GitHub](https://github.com/platformatic/examples/tree/main/applications/build-modular-monolith-with-platformatic?utm_campaign=Build%20and%20deploy%20a%20modular%20monolith%20with%20Platformatic&utm_medium=blog&utm_source=Platformatic%20Blog).

You can watch Platformatic Runtime and Gateway in action in the deep dive videos that our Co-founder and CTO [Matteo Collina](https://twitter.com/matteocollina?utm_campaign=Build%20and%20deploy%20a%20modular%20monolith%20with%20Platformatic&utm_medium=blog&utm_source=Platformatic%20Blog) created for our [Papilio Launch](https://papilio.platformatic.dev/?utm_campaign=Build%20and%20deploy%20a%20modular%20monolith%20with%20Platformatic&utm_medium=blog&utm_source=Platformatic%20Blog):

- [Introducing: Platformatic Runtime](https://www.youtube.com/watch?v=KGzAURD8mcc&list=PL_x4nRdxj60K1zx4pCOEXUTQKkDg8WpCR&index=2?utm_campaign=Build%20and%20deploy%20a%20modular%20monolith%20with%20Platformatic&utm_medium=blog&utm_source=Platformatic%20Blog)
- [Introducing: Platformatic Gateway](https://www.youtube.com/watch?v=0DeNIeSnH0E&list=PL_x4nRdxj60K1zx4pCOEXUTQKkDg8WpCR&index=3?utm_campaign=Build%20and%20deploy%20a%20modular%20monolith%20with%20Platformatic&utm_medium=blog&utm_source=Platformatic%20Blog)
- [Introducing: Client & Taxonomy](https://www.youtube.com/watch?v=W_bXefh-j4A&list=PL_x4nRdxj60K1zx4pCOEXUTQKkDg8WpCR&index=4?utm_campaign=Build%20and%20deploy%20a%20modular%20monolith%20with%20Platformatic&utm_medium=blog&utm_source=Platformatic%20Blog)

### Get started with Platformatic

- Build robust Node.js apps with [our open-source tools](https://docs.platformatic.dev/?utm_campaign=Blog%20post%20-%20Building%20REST%20APIs%20with%20Platformatic%20DB&utm_medium=blog&utm_source=Platformatic%20Blog?utm_campaign=Build%20and%20deploy%20a%20modular%20monolith%20with%20Platformatic&utm_medium=blog&utm_source=Platformatic%20Blog)
- Join [our community](https://discord.gg/platformatic?utm_campaign=Blog%20post%20-%20Building%20REST%20APIs%20with%20Platformatic%20DB&utm_medium=blog&utm_source=Platformatic%20Blog?utm_campaign=Build%20and%20deploy%20a%20modular%20monolith%20with%20Platformatic&utm_medium=blog&utm_source=Platformatic%20Blog) on Discord
