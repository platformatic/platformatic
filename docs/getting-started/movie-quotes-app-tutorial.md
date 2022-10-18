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

- [Node.js](https://nodejs.org/) >= v16.17.0 or >= v18.8.0
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

Then let's create a `package.json` file:

```bash
npm init --yes
```

Now we can install the [platformatic](https://www.npmjs.com/package/platformatic)
CLI as a dependency:

```bash
npm install platformatic
```

Let's also add some npm run scripts for convenience:

```bash
npm pkg set scripts.start="platformatic db start"

npm pkg set scripts.dev="npm start"
```

Now we're going to configure our API. Let's create our Platformatic configuration
file, **`platformatic.db.json`**:

```json
{
  "server": {
    "logger": {
      "level": "{PLT_SERVER_LOGGER_LEVEL}"
    },
    "hostname": "{PLT_SERVER_HOSTNAME}",
    "port": "{PORT}"
  },
  "core": {
    "connectionString": "{DATABASE_URL}"
  },
  "migrations": {
    "dir": "./migrations",
    "autoApply": true
  }
}
```

Now we'll create a **`.env`** file with settings for our configuration to use:

```
PORT=3042
PLT_SERVER_HOSTNAME=127.0.0.1
PLT_SERVER_LOGGER_LEVEL=info
DATABASE_URL=sqlite://./movie-quotes.sqlite
```

:::info

Take a look at the [Configuration reference](/reference/db/configuration.md)
to see all the supported configuration settings.

:::

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

Let's also create `.gitignore` so that we avoid accidentally committing our
SQLite database:

```bash
echo '*.sqlite' > .gitignore
```

Now we can start the Platformatic DB server:

```bash
npm run dev
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
{"id":1,"quote":"Toto, I've got a feeling we're not in Kansas anymore.","saidBy":"Dorothy Gale","createdAt":"2022-09-13 10:39:35"}
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
npm run dev
```

The new migration should be automatically applied and we'll see the log message
`running 002.do.sql`.

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
rm movie-quotes.sqlite
```

Now let's create a fresh SQLite database by running our migrations:

```bash
npx platformatic db migrate
```

And then let's populate the `quotes` and `movies` tables with data using our
seed script:

```bash
npx platformatic db seed seed.js
```

Our database is full of data, but we don't have anywhere to display it. It's
time to start building our frontend!

## Build the frontend

We're now going to use [Astro](https://astro.build/) to build our frontend
application. If you've not used it before, you might find it helpful
to read [this overview](https://docs.astro.build/en/core-concepts/astro-components/)
on how Astro components are structured.

:::tip
Astro provide some extensions and tools to help improve your
[Editor Setup](https://docs.astro.build/en/editor-setup/) when building an
Astro application.
:::

### Create an Astro application

In the root of our project, let's create a new directory for our frontent
application:

```bash
mkdir -p apps/movie-quotes-frontend/

cd apps/movie-quotes-frontend/
```

And then we'll create a new `package.json` file:

```bash
npm init --yes
```

Now we can install [astro](https://www.npmjs.com/package/astro) as a dependency:

```bash
npm install --save-dev astro
```

Then let's set up some npm run scripts for convenience:

```bash
npm pkg delete scripts.test
npm pkg set scripts.dev="astro dev --port 3000"
npm pkg set scripts.start="astro dev --port 3000"
npm pkg set scripts.build="astro build"
```

Now we'll create our Astro configuration file, **`astro.config.mjs`** and
copy and paste in this code:

```javascript
import { defineConfig } from 'astro/config'

// https://astro.build/config
export default defineConfig({
  output: 'server'
})
```

And we'll also create a **`tsconfig.json`** file and add in this configuration:

```json
{
  "extends": "astro/tsconfigs/base",
  "compilerOptions": {
    "types": ["astro/client"]
  }
}
```

Now let's create the directories where we'll be adding the components for our
frontend application:

```bash
mkdir -p src/pages src/layouts src/components
```

And inside the **`src/pages`** directory let's create our first page, **`index.astro`**:

```astro
<h1>Movie Quotes</h1>
```

Now we can start up the Astro development server with:

```bash
npm run dev
```

And then load up the frontend in our browser at [http://localhost:3000](http://localhost:3000)

### Create a layout

In the **`src/layouts`** directory, let's create a new file named **`Layout.astro`**:

```astro
---
export interface Props {
  title: string;
  page?: string;
}
const { title, page } = Astro.props;
---

<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <title>{title}</title>
  </head>
  <body>
    <header>
      <h1>🎬 Movie Quotes</h1>
    </header>
    <nav>
      <a href="/">All quotes</a>
    </nav>
    <section>
      <slot />
    </section>
  </body>
</html>
```

The code between the `---` is known as the component script, and the
code after that is the component template. The component script will *only* run
on the server side when a web browser makes a request. The component template
is rendered server side and sent back as an HTML response to the web browser.

Now we'll update **`src/pages/index.astro`** to use this `Layout` component.
Let's replace the contents of **`src/pages/index.astro`** with this code:

```astro
---
import Layout from '../layouts/Layout.astro';
---

<Layout title="All quotes" page="listing">
  <main>
    <p>We'll list all the movie quotes here.</p>
  </main>
</Layout>
```

### Integrate the urql GraphQL client

We're now going to integrate the [URQL](https://formidable.com/open-source/urql/)
GraphQL client into our frontend application. This will allow us to run queries
and mutations against our Platformatic GraphQL API.

Let's first install [@urql/core](https://www.npmjs.com/package/@urql/core) and
[graphql](https://www.npmjs.com/package/graphql) as project dependencies:

```bash
npm install @urql/core graphql
```

Then let's create a new **`.env`** file and add this configuration:

```
PUBLIC_GRAPHQL_API_ENDPOINT=http://127.0.0.1:3042/graphql
```

Now we'll create a new directory:

```bash
mkdir src/lib
```

And then create a new file named **`src/lib/quotes-api.js`**. In that file we'll
create a new URQL client:

```javascript
// src/lib/quotes-api.js

import { createClient } from '@urql/core';

const graphqlClient = createClient({
  url: import.meta.env.PUBLIC_GRAPHQL_API_ENDPOINT,
  requestPolicy: "network-only"
});
```

We'll also add a thin wrapper around the client that does some basic error
handling for us:

```javascript
// src/lib/quotes-api.js

async function graphqlClientWrapper(method, gqlQuery, queryVariables = {}) {
	const queryResult = await graphqlClient[method](
		gqlQuery,
		queryVariables
	).toPromise();

	if (queryResult.error) {
		console.error("GraphQL error:", queryResult.error);
	}

	return {
		data: queryResult.data,
		error: queryResult.error,
	};
}

export const quotesApi = {
	async query(gqlQuery, queryVariables = {}) {
		return await graphqlClientWrapper("query", gqlQuery, queryVariables);
	},
	async mutation(gqlQuery, queryVariables = {}) {
		return await graphqlClientWrapper("mutation", gqlQuery, queryVariables);
	}
}
```

And lastly, we'll export `gql` from the `@urql/core` package, to make it
simpler for us to write GraphQL queries in our pages:

```javascript
// src/lib/quotes-api.js

export { gql } from "@urql/core";
```

Stop the Astro dev server and then start it again so it picks up the **`.env`**
file:

```bash
npm run dev
```

### Display all quotes

Let's display all the movie quotes in **`src/pages/index.astro`**.

First, we'll update the component script at the top and add in a query to
our GraphQL API for quotes:

```astro
---
import Layout from '../layouts/Layout.astro';
// highlight-start
import { quotesApi, gql } from '../lib/quotes-api';

const { data } = await quotesApi.query(gql`
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
`);

const quotes = data?.quotes || [];
// highlight-end
---
```

Then we'll update the component template to display the quotes:

```astro
<Layout title="All quotes" page="listing">
  <main>
// highlight-start
    {quotes.length > 0 ? quotes.map((quote) => (
      <div>
        <blockquote>
          <p>{quote.quote}</p>
        </blockquote>
        <p>
          — {quote.saidBy}, {quote.movie?.name}
        </p>
        <div>
          <span>Added {new Date(quote.createdAt).toUTCString()}</span>
        </div>
      </div>
    )) : (
      <p>No movie quotes have been added.</p>
    )}
// highlight-end
  </main>
</Layout>
```

And just like that, we have all the movie quotes displaying on the page!

### Integrate Tailwind for styling

Automatically add the [@astrojs/tailwind integration](https://docs.astro.build/en/guides/integrations-guide/tailwind/):

```bash
npx astro add tailwind --yes
```

Add the Tailwind CSS [Typography](https://tailwindcss.com/docs/typography-plugin)
and [Forms](https://github.com/tailwindlabs/tailwindcss-forms) plugins:

```bash
npm install --save-dev @tailwindcss/typography @tailwindcss/forms
```

Import the plugins in our Tailwind configuration file:

```javascript
// tailwind.config.cjs

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {}
  },
// highlight-start
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography')
  ]
// highlight-end
}
```

Stop the Astro dev server and then start it again so it picks up all the
configuration changes:

```bash
npm run dev
```

### Style the listing page

To style our listing page, let's add CSS classes to the component template in
**`src/layouts/Layout.astro`**:

```astro
---
export interface Props {
	title: string;
	page?: string;
}

const { title, page } = Astro.props;

// highlight-next-line
const navActiveClasses = "font-bold bg-yellow-400 no-underline";
---

<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <title>{title}</title>
  </head>
// highlight-next-line
  <body class="py-8">
// highlight-next-line
    <header class="prose mx-auto mb-6">
      <h1>🎬 Movie Quotes</h1>
    </header>
// highlight-next-line
    <nav class="prose mx-auto mb-6 border-y border-gray-200 flex">
// highlight-next-line
      <a href="/" class={`p-3 ${page === "listing" && navActiveClasses}`}>All quotes</a>
    </nav>
// highlight-next-line
    <section class="prose mx-auto">
      <slot />
    </section>
  </body>
</html>
```

Then let's add CSS classes to the component template in **`src/pages/index.astro`**:

```astro
<Layout title="All quotes">
  <main>
    {quotes.length > 0 ? quotes.map((quote) => (
// highlight-next-line
      <div class="border-b mb-6">
// highlight-next-line
        <blockquote class="text-2xl mb-0">
// highlight-next-line
          <p class="mb-4">{quote.quote}</p>
        </blockquote>
// highlight-next-line
        <p class="text-xl mt-0 mb-8 text-gray-400">
          — {quote.saidBy}, {quote.movie?.name}
        </p>
// highlight-next-line
        <div class="flex flex-col mb-6 text-gray-400">
// highlight-next-line
          <span class="text-gray-400 italic">Added {new Date(quote.createdAt).toUTCString()}</span>
        </div>
      </div>
    )) : (
      <p>No movie quotes have been added.</p>
    )}
  </main>
</Layout>
```

Our listing page is now looking much more user friendly!

### Create an add quote page

We're going to create a form component that we can use for adding and editing
quotes.

First let's create a new component file, **`src/components/QuoteForm.astro`**:

```astro
---
export interface QuoteFormData {
  id?: number;
  quote?: string;
  saidBy?: string;
  movie?: string;
}

export interface Props {
  action: string;
  values?: QuoteFormData;
  saveError?: boolean;
  loadError?: boolean;
  submitLabel: string;
}

const { action, values = {}, saveError, loadError, submitLabel } = Astro.props;
---

{saveError && <p class="text-lg bg-red-200 p-4">There was an error saving the quote. Please try again.</p>}
{loadError && <p class="text-lg bg-red-200 p-4">There was an error loading the quote. Please try again.</p>}

<form method="post" action={action} class="grid grid-cols-1 gap-6">
  <label for="quote" class="block">
    <span>Quote</span>
    <textarea id="quote" name="quote" required="required" class="mt-1 w-full">{values.quote}</textarea>
  </label>
  <label for="said-by" class="block">
    <span>Said by</span>
    <input type="text" id="said-by" name="saidBy" required="required" value={values.saidBy} class="mt-1 w-full">
  </label>
  <label for="movie" class="block">
    <span>Movie</span>
    <input type="text" id="movie" name="movie" required="required" autocomplete="off" value={values.movie} class="form-input mt-1 w-full">
  </label>
  <input type="submit" value={submitLabel} disabled={loadError && "disabled"} class="bg-yellow-400 hover:bg-yellow-500 text-gray-900 round p-3" />
</form>
```

Create a new page file, **`src/pages/add.astro`**:

```astro
---
import Layout from '../layouts/Layout.astro';
import QuoteForm from '../components/QuoteForm.astro';
import type { QuoteFormData } from '../components/QuoteForm.astro';

let formData: QuoteFormData = {};
let saveError = false;
---

<Layout title="Add a movie quote" page="add">
  <main>
    <h2>Add a quote</h2>
    <QuoteForm action="/add" values={formData} saveError={saveError} submitLabel="Add quote" />
  </main>
</Layout>
```

And now let's add a link to this page in the layout navigation in **`src/layouts/Layout.astro`**:

```astro
<nav class="prose mx-auto mb-6 border-y border-gray-200 flex">
  <a href="/" class={`p-3 ${page === "listing" && navActiveClasses}`}>All quotes</a>
// highlight-next-line
  <a href="/add" class={`p-3 ${page === "add" && navActiveClasses}`}>Add a quote</a>
</nav>
```

### Send form data to the API

When a user submits the add quote form we want to send the form data to our API
so it can then save it to our database. Let's wire that up now.

First we're going to create a new file, **`src/lib/request-utils.js`**:

```javascript
export function isPostRequest (request) {
  return request.method === 'POST'
}

export async function getFormData (request) {
  const formData = await request.formData()

  return Object.fromEntries(formData.entries())
}
```

Then let's update the component script in **`src/pages/add.astro`** to use
these new request utility functions:

```astro
---
import Layout from '../layouts/Layout.astro';
import QuoteForm from '../components/QuoteForm.astro';
import type { QuoteFormData } from '../components/QuoteForm.astro';

// highlight-next-line
import { isPostRequest, getFormData } from '../lib/request-utils';

let formData: QuoteFormData = {};
let saveError = false;

// highlight-start
if (isPostRequest(Astro.request)) {
  formData = await getFormData(Astro.request);
}
// highlight-end
---
```

When we create a new quote entity record via our API, we need to include a
`movieId` field that references a movie entity record. This means that when a
user submits the add quote form we need to:

- Check if a movie entity record already exists with that movie name
- Return the movie `id` if it does exist
- If it doesn't exist, create a new movie entity record and return the movie ID

Let's update the `import` statement at the top of **`src/lib/quotes-api.js`**

```diff
-import { createClient } from '@urql/core'
+import { createClient, gql } from '@urql/core'
```

And then add a new method that will return a movie ID for us:

```javascript
async function getMovieId (movieName) {
  movieName = movieName.trim()

  let movieId = null

  // Check if a movie already exists with the provided name.
  const queryMoviesResult = await quotesApi.query(
    gql`
      query ($movieName: String!) {
        movies(where: { name: { eq: $movieName } }) {
          id
        }
      }
    `,
    { movieName }
  )

  if (queryMoviesResult.error) {
    return null
  }

  const movieExists = queryMoviesResult.data?.movies.length === 1
  if (movieExists) {
    movieId = queryMoviesResult.data.movies[0].id
  } else {
    // Create a new movie entity record.
    const saveMovieResult = await quotesApi.mutation(
      gql`
        mutation ($movieName: String!) {
          saveMovie(input: { name: $movieName }) {
            id
          }
        }
      `,
      { movieName }
    )

    if (saveMovieResult.error) {
      return null
    }

    movieId = saveMovieResult.data?.saveMovie.id
  }

  return movieId
}
```

And let's export it too:

```javascript
export const quotesApi = {
  async query (gqlQuery, queryVariables = {}) {
    return await graphqlClientWrapper('query', gqlQuery, queryVariables)
  },
  async mutation (gqlQuery, queryVariables = {}) {
    return await graphqlClientWrapper('mutation', gqlQuery, queryVariables)
  },
// highlight-next-line
  getMovieId
}
```

Now we can wire up the last parts in the **`src/pages/add.astro`** component
script:

```astro
---
import Layout from '../layouts/Layout.astro';
import QuoteForm from '../components/QuoteForm.astro';
import type { QuoteFormData } from '../components/QuoteForm.astro';

// highlight-next-line
import { quotesApi, gql } from '../lib/quotes-api';
import { isPostRequest, getFormData } from '../lib/request-utils';

let formData: QuoteFormData = {};
let saveError = false;

if (isPostRequest(Astro.request)) {
  formData = await getFormData(Astro.request);

// highlight-start
  const movieId = await quotesApi.getMovieId(formData.movie);

  if (movieId) {
    const quote = {
      quote: formData.quote,
      saidBy: formData.saidBy,
      movieId,
    };

    const { error } = await quotesApi.mutation(gql`
      mutation($quote: QuoteInput!) {
        saveQuote(input: $quote) {
          id
        }
      }
    `, { quote });

    if (!error) {
      return Astro.redirect('/');
    } else {
      saveError = true;
    }
  } else {
    saveError = true;
  }
// highlight-end
}
```

### Add autosuggest for movies

We can create a better experience for our users by autosuggesting the movie name
when they're adding a new quote.

Let's open up **`src/components/QuoteForm.astro`** and import our API helper methods
in the component script:

```astro
import { quotesApi, gql } from '../lib/quotes-api.js';
```

Then let's add in a query to our GraphQL API for all movies:

```astro
const { data } = await quotesApi.query(gql`
  query {
    movies {
      name
    }
  }
`);

const movies = data?.movies || [];
```

Now lets update the *Movie* field in the component template to use the
array of movies that we've retrieved from the API:

```astro
<label for="movie" class="block">
  <span>Movie</span>
// highlight-start
  <input list="movies" id="movie" name="movie" required="required" autocomplete="off" value={values.movie} class="form-input mt-1 w-full">
  <datalist id="movies">
    {movies.map(({ name }) => (
      <option>{name}</option>
    ))}
  </datalist>
// highlight-end
</label>
```

### Create an edit quote page

Let's create a new directory, **`src/pages/edit/`**:

```bash
mkdir src/pages/edit/
```

And inside of it, let's create a new page, **`[id].astro`**:

```astro
---
import Layout from '../../layouts/Layout.astro';
import QuoteForm, { QuoteFormData } from '../../components/QuoteForm.astro';

const id = Number(Astro.params.id);

let formValues: QuoteFormData = {};
let loadError = false;
let saveError = false;
---

<Layout title="Edit movie quote">
  <main>
    <h2>Edit quote</h2>
    <QuoteForm action={`/edit/${id}`} values={formValues} saveError={saveError} loadError={loadError} submitLabel="Update quote" />
  </main>
</Layout>
```

You'll see that we're using the same `QuoteForm` component that our add quote
page uses. Now we're going to wire up our edit page so that it can load an
existing quote from our API and save changes back to the API when the form is
submitted.

In the **`[id.astro]`** component script, let's add some code to take care of
these tasks:

```astro
---
import Layout from '../../layouts/Layout.astro';
import QuoteForm, { QuoteFormData } from '../../components/QuoteForm.astro';

// highlight-start
import { quotesApi, gql } from '../../lib/quotes-api';
import { isPostRequest, getFormData } from '../../lib/request-utils';
// highlight-end

const id = Number(Astro.params.id);

let formValues: QuoteFormData = {};
let loadError = false;
let saveError = false;

// highlight-start
if (isPostRequest(Astro.request)) {
  const formData = await getFormData(Astro.request);
  formValues = formData;

  const movieId = await quotesApi.getMovieId(formData.movie);

  if (movieId) {
    const quote = {
      id,
      quote: formData.quote,
      saidBy: formData.saidBy,
      movieId,
    };

    const { error } = await quotesApi.mutation(gql`
      mutation($quote: QuoteInput!) {
        saveQuote(input: $quote) {
          id
        }
      }
    `, { quote });

    if (!error) {
      return Astro.redirect('/');
    } else {
      saveError = true;
    }
  } else {
    saveError = true;
  }
} else {
  const { data } = await quotesApi.query(gql`
    query($id: ID!) {
      getQuoteById(id: $id) {
        id
        quote
        saidBy
        movie {
          id
          name
        }
      }
    }
  `, { id });

  if (data?.getQuoteById) {
    formValues = {
      ...data.getQuoteById,
      movie: data.getQuoteById.movie.name
    };
  } else {
    loadError = true;
  }
}
// highlight-end
---
```

Load up [http://localhost:3000/edit/1](http://localhost:3000/edit/1) in your
browser to test out the edit quote page.

Now we're going to add edit links to the quotes listing page. Let's start by
creating a new component **`src/components/QuoteActionEdit.astro`**:

```astro
---
export interface Props {
  id: number;
}

const { id } = Astro.props;
---
<a href={`/edit/${id}`} class="flex items-center mr-5 text-gray-400 hover:text-yellow-600 underline decoration-yellow-600 decoration-2 underline-offset-4">
  <svg class="w-6 h-6 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
    <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z" />
    <path d="M5.25 5.25a3 3 0 00-3 3v10.5a3 3 0 003 3h10.5a3 3 0 003-3V13.5a.75.75 0 00-1.5 0v5.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V8.25a1.5 1.5 0 011.5-1.5h5.25a.75.75 0 000-1.5H5.25z" />
  </svg>
  <span class="hover:underline hover:decoration-yellow-600">Edit</span>
</a>
```

Then let's import this component and use it in our listing page,
**`src/pages/index.astro`**:

```astro
---
import Layout from '../layouts/Layout.astro';
// highlight-next-line
import QuoteActionEdit from '../components/QuoteActionEdit.astro';
import { quotesApi, gql } from '../lib/quotes-api';

// ...
---

<Layout title="All quotes" page="listing">
  <main>
    {quotes.length > 0 ? quotes.map((quote) => (
      <div class="border-b mb-6">
        ...
        <div class="flex flex-col mb-6 text-gray-400">
// highlight-start
          <span class="flex items-center">
            <QuoteActionEdit id={quote.id} />
          </span>
          <span class="mt-4 text-gray-400 italic">Added {new Date(quote.createdAt).toUTCString()}</span>
// highlight-end
        </div>
      </div>
    )) : (
      <p>No movie quotes have been added.</p>
    )}
  </main>
</Layout>
```

### Add delete quote functionality

Our Movie Quotes app can create, retrieve and update quotes. Now we're going
to implement the D in CRUD — delete!

First let's create a new component, **`src/components/QuoteActionDelete.astro`**:

```astro
---
export interface Props {
  id: number;
}

const { id } = Astro.props;
---
<form method="POST" action={`/delete/${id}`} class="form-delete-quote m-0">
  <button type="submit" class="flex items-center text-gray-400 hover:text-red-700 underline decoration-red-700 decoration-2 underline-offset-4">
    <svg class="w-6 h-6 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
      <path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clip-rule="evenodd" />
    </svg>
    <span>Delete</span>
  </button>
</form>
```

And then we'll drop it into our listing page, **`src/pages/index.astro`**:

```astro
---
import Layout from '../layouts/Layout.astro';
import QuoteActionEdit from '../components/QuoteActionEdit.astro';
// highlight-next-line
import QuoteActionDelete from '../components/QuoteActionDelete.astro';
import { quotesApi, gql } from '../lib/quotes-api';

// ...
---

<Layout title="All quotes" page="listing">
  <main>
    {quotes.length > 0 ? quotes.map((quote) => (
      <div class="border-b mb-6">
        ...
        <div class="flex flex-col mb-6 text-gray-400">
          <span class="flex items-center">
            <QuoteActionEdit id={quote.id} />
// highlight-next-line
            <QuoteActionDelete id={quote.id} />
          </span>
          <span class="mt-4 text-gray-400 italic">Added {new Date(quote.createdAt).toUTCString()}</span>
        </div>
      </div>
...
```

At the moment when a delete form is submitted from our listing page, we get
an Astro 404 page. Let's fix this by creating a new directory, **`src/pages/delete/`**:

```bash
mkdir src/pages/delete/
```

And inside of it, let's create a new page, **`[id].astro`**:

```astro
---
import Layout from '../../layouts/Layout.astro';

import { quotesApi, gql } from '../../lib/quotes-api';
import { isPostRequest } from '../../lib/request-utils';

if (isPostRequest(Astro.request)) {
  const id = Number(Astro.params.id);

  const { error } = await quotesApi.mutation(gql`
    mutation($id: ID!) {
      deleteQuotes(where: { id: { eq: $id }}) {
        id
      }
    }
  `, { id });

  if (!error) {
    return Astro.redirect('/');
  }
}
---
<Layout title="Delete movie quote">
  <main>
    <h2>Delete quote</h2>
    <p class="text-lg bg-red-200 p-4">There was an error deleting the quote. Please try again.</p>
  </main>
</Layout>
```

Now if we click on a delete quote button on our listings page, it should call our
GraphQL API to delete the quote. To make this a little more user friendly, let's
add in a confirmation dialog so that users don't delete a quote by accident.

<!-- TODO: There's an Astro bug with client side scripts in dev: https://github.com/withastro/astro/issues/4217 -->
<!-- TODO: Potentially leave this out, especially as there's an Astro bug -->

Let's create a new directory, **`src/scripts/`**:

```bash
mkdir src/scripts/
```

And inside of that directory let's create a new file, **`quote-actions.js`**:

```javascript
// src/scripts/quote-actions.js

export function confirmDeleteQuote (form) {
  if (confirm('Are you sure want to delete this quote?')) {
    form.submit()
  }
}
```

Then we can pull it in as client side JavaScript on our listing page,
**`src/pages/index.astro`**:

```astro
<Layout>
  ...
</Layout>

<script>
  import { confirmDeleteQuote } from '../scripts/quote-actions.js'

  addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.form-delete-quote').forEach((deleteForm) => {
      deleteForm.addEventListener('submit', (event) => {
        event.preventDefault()
        confirmDeleteQuote(event.currentTarget)
      })
    })
  })
</script>
```

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
  "plugin": {
    "path": "./plugin.js"
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

### Add a REST API route

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

### Add like quote functionality

Now that our API supports "liking" a quote, let's integrate it as a feature in
our frontend.

First we'll create a new component, **`src/components/QuoteActionLike.astro`**:

```astro
---
export interface Props {
  id: number;
  likes: number;
}

const { id, likes } = Astro.props;
---
<span data-quote-id={id} class="like-quote cursor-pointer mr-5 flex items-center">
  <svg class="like-icon w-6 h-6 mr-2 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
    <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
  </svg>
  <span class="likes-count w-8">{likes}</span>
</span>

<style>
  .like-quote:hover .like-icon,
  .like-quote.liked .like-icon {
    fill: currentColor;
  }
</style>
```

And in our listing page, **`src/pages/index.astro`**, let's import our new
component and add it into the interface:

```astro
---
import Layout from '../layouts/Layout.astro';
import QuoteActionEdit from '../components/QuoteActionEdit.astro';
import QuoteActionDelete from '../components/QuoteActionDelete.astro';
// highlight-next-line
import QuoteActionLike from '../components/QuoteActionLike.astro';
import { quotesApi, gql } from '../lib/quotes-api';

// ...
---

<Layout title="All quotes" page="listing">
  <main>
    {quotes.length > 0 ? quotes.map((quote) => (
      <div class="border-b mb-6">
        ...
        <div class="flex flex-col mb-6 text-gray-400">
          <span class="flex items-center">
// highlight-next-line
            <QuoteActionLike id={quote.id} likes={quote.likes} />
            <QuoteActionEdit id={quote.id} />
            <QuoteActionDelete id={quote.id} />
          </span>
          <span class="mt-4 text-gray-400 italic">Added {new Date(quote.createdAt).toUTCString()}</span>
        </div>
      </div>
...
```

Then let's update the GraphQL query in this component's script to retrieve the
`likes` field for all quotes:

```javascript
const { data } = await quotesApi.query(gql`
  query {
    quotes {
      id
      quote
      saidBy
// highlight-next-line
      likes
      createdAt
      movie {
        id
        name
      }
    }
  }
`);
```

Now we have the likes showing for each quote, let's wire things up so that
clicking on the like component for a quote will call our API and add a like.

Let's open up **`src/scripts/quote-actions.js`** and add a new function that
makes a request to our GraphQL API:

```javascript
// highlight-next-line
import { quotesApi, gql } from '../lib/quotes-api.js'

export function confirmDeleteQuote (form) {
  if (confirm('Are you sure want to delete this quote?')) {
    form.submit()
  }
}

// highlight-start
export async function likeQuote (likeQuote) {
  likeQuote.classList.add('liked')
  likeQuote.classList.remove('cursor-pointer')

  const id = Number(likeQuote.dataset.quoteId)

  const { data } = await quotesApi.mutation(gql`
    mutation($id: ID!) {
      likeQuote(id: $id)
    }
  `, { id })

  if (data?.likeQuote) {
    likeQuote.querySelector('.likes-count').innerText = data.likeQuote
  }
}
// highlight-end
```

And then let's attach the `likeQuote` function to the click event for each
like quote component on our listing page. We can do this by adding a little
extra code inside the `<script>` block in **`src/pages/index.astro`**:

```html
<script>
// highlight-next-line
  import { confirmDeleteQuote, likeQuote } from '../scripts/quote-actions.js'

  addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.form-delete-quote').forEach((deleteForm) => {
      deleteForm.addEventListener('submit', (event) => {
        event.preventDefault()
        confirmDeleteQuote(event.currentTarget)
      })
    })

// highlight-start
    document.querySelectorAll('.like-quote').forEach((container) => {
      container.addEventListener('click', (event) => likeQuote(event.currentTarget), { once: true })
    })
// highlight-end
  })
</script>
```

### Sort the listing by top quotes

Now that users can like their favourite quotes, as a final step, we'll allow
for sorting quotes on the listing page by the number of likes they have.

Let's update **`src/pages/index.astro`** to read a `sort` query string parameter
and use it the GraphQL query that we make to our API:

```astro
---
// ...

// highlight-start
const allowedSortFields = ["createdAt", "likes"];
const searchParamSort = new URL(Astro.request.url).searchParams.get("sort");
const sort = allowedSortFields.includes(searchParamSort) ? searchParamSort : "createdAt";
// highlight-end

const { data } = await quotesApi.query(gql`
  query {
// highlight-next-line
    quotes(orderBy: {field: ${sort}, direction: DESC}) {
      id
      quote
      saidBy
      likes
      createdAt
      movie {
        id
        name
      }
    }
  }
`);

const quotes = data?.quotes || [];
---
// highlight-next-line
<Layout title="All quotes" page={`listing-${sort}`}>
...
```

Then let's replace the 'All quotes' link in the `<nav>` in **`src/layouts/Layout.astro`**
with two new links:

```astro
<nav class="prose mx-auto mb-6 border-y border-gray-200 flex">
// highlight-start
  <a href="/?sort=createdAt" class={`p-3 ${page === "listing-createdAt" && navActiveClasses}`}>Latest quotes</a>
  <a href="/?sort=likes" class={`p-3 ${page === "listing-likes" && navActiveClasses}`}>Top quotes</a>
// highlight-end
  <a href="/add" class={`p-3 ${page === "add" && navActiveClasses}`}>Add a quote</a>
</nav>
```

With these few extra lines of code, our users can now sort quotes by when they
were created or by the number of likes that they have. Neat!

## Wrapping up

And we're done — you now have the knowledge you need to build a full stack
application on top of Platformatic DB.

We can't wait to see what you'll build next!
