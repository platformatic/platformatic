import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

import SetupWatt from '../getting-started/setup-watt.md';
import NewApiSetup from '../getting-started/quick-start-guide.md';

# Migrating a Fastify App to Platformatic Service

Fastify is an excellent choice for building production-ready Node.js applications, but it often requires boilerplate setup due to its core principles:

- **Modular Design**: Fastify encourages plugins to separate concerns and improve testability (see [Plugins](https://www.fastify.io/docs/latest/Reference/Plugins/)).
- **Minimal Assumptions**: Developers have freedom in architecture, plugins, and patterns.
- **Custom Solutions**: Fastify provides flexibility over pre-defined standards.
  
[Platformatic Service](https://docs.platformatic.dev/docs/service/overview) builds on Fastify, streamlining development with best practices baked in, making it easier to start, scale, and maintain production-ready applications.

This guide walks you through migrating a Fastify app to Platformatic Service.

## Example Fastify application

Here’s the structure of the example Fastify app we’ll migrate:

> The code for the example Fastify and migrated Platformatic Service applications is available [on GitHub](https://github.com/platformatic/examples/blob/main/applications/migrate-fastify-app-to-platformatic-service/).

```js
├── app.js
├── package.json
├── plugins
│   └── data-source.js
├── routes
│   ├── movies.js
│   └── quotes.js
├── server.js
└── test
    └── routes.test.js
```

**Dependencies**:

```json
"dependencies": {
  "fastify": "^4.17.0",
  "fastify-plugin": "^4.5.0"
}
```

### Key Components

1. **Plugins**: Add app-wide decorators (e.g., data source):

```js
// plugins/data-source.js
import fastifyPlugin from 'fastify-plugin';

async function dataSource(app) {
  app.decorate('movies', ['Jaws', 'Star Wars', 'The Wizard of Oz']);
  app.decorate('quotes', [
    "You're gonna need a bigger boat.",
    "May the Force be with you.",
    "Toto, I've a feeling we're not in Kansas anymore."
  ]);
}

export default fastifyPlugin(dataSource);
```

2. **Routes**: Define API endpoints

```js
// routes/movies.js
export default async function movieRoutes(app) {
  app.get('/', async () => app.movies);
}
```

3. **App Initialization:**

```js
// app.js
import fastify from 'fastify';

export async function buildApp(options = {}) {
  const app = fastify(options);

  app.register(import('./plugins/data-source.js'));
  app.register(import('./routes/movies.js'), { prefix: '/movies' });
  app.register(import('./routes/quotes.js'), { prefix: '/quotes' });

  return app;
}
```

4. **Server Start**:

```js
// server.js
import { buildApp } from './app.js';

const app = await buildApp({ logger: { level: 'info' } });
await app.listen({ port: 3042, host: '127.0.0.1' });
```

## Migrating to Platformatic Service

### Setup a Platformatic Watt Application 

Run the command below and create a Watt application:

<SetupWatt />


### Add a Platformatic Service 

To start the Platformatic creator wizard, run the appropriate command for your package manager in your terminal:

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
pnpm create platformatic@latest
```

</TabItem>
</Tabs>

This interactive command-line tool will guide you through setting up a new Platformatic project. For this guide, please choose the following options:

```
- Where would you like to create your project?  => .
- Which kind of project do you want to create?  => @platformatic/service
- What is the name of the service?              => (generated-randomly), e.g. legal-soup
- What is the connection string?                => sqlite://./db.sqlite
- Do you want to create default migrations?     => Yes
- Do you want to create another service?        => No
- Do you want to use TypeScript?                => No
- What port do you want to use?                 => 3042
- Do you want to init the git repository?       => No
```

After completing the wizard, your Platformatic application will be ready in the specified folder. This includes example migration files, plugin scripts, routes, and tests within your service directory.

:::note

If the wizard does not handle dependency installation, ensure to run `npm/yarn/pnpm` install command manually:

:::

### Refactor Plugins 

Copy over your Fastify plugins without changes:

**Original Plugin**

```js
import fastifyPlugin from 'fastify-plugin'

/** @param {import('fastify').FastifyInstance} app */
async function dataSource (app) {
  app.decorate('movies', [
    'Jaws',
    'Star Wars',
    'The Wizard of Oz'
  ])

  app.decorate('quotes', [
    'You\'re gonna need a bigger boat.',
    'May the Force be with you.',
    'Toto, I\'ve got a feeling we\'re not in Kansas anymore.'
  ])
}

export default fastifyPlugin(dataSource)
```

Create a new file, `data-source` in the `plugins` folder of your `web/service` directory and add a new plugin:

```js
/// <reference path="../global.d.ts" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify  */
module.exports = async function movies(fastify, opts) {
  fastify.decorate('movies', [
    'Jaws',
    'Star Wars',
    'The Wizard of Oz'
  ]);
  
  fastify.decorate('quotes', [
    'You\'re gonna need a bigger boat.',
    'May the Force be with you.',
    'Toto, I\'ve got a feeling we\'re not in Kansas anymore.'
  ]);
};
```

### Refactor Routes 

Copy over your `routes` directory and create new files `quotes.js` and `movies.js`. Create a `quotes.js` route:

```js
/// <reference path="../global.d.ts" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.get('/quotes', async (request, reply) => {
    return fastify.quotes
  })
}
```

Create a `movies.js` route in the `routes` directory of your service application. 

```js
/// <reference path="../global.d.ts" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.get('/movies', async (request, reply) => {
    return fastify.movies
  })
}
``` 

### Update Tests 
Platformatic provides a programmatic API for testing applications. In your test folder of your service directory, create a new file `routes.test.js`:
   
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildServer } from '@platformatic/service'

import serviceConfig from '../platformatic.json' assert { type: 'json' }

serviceConfig.server.logger = false

test('Basic API', async (t) => {
  const app = await buildServer(serviceConfig)

  t.after(async () => {
    await app.close()
  })

  await t.test('GET request to /movies route', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/movies'
    })

    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), [
      'Jaws',
      'Star Wars',
      'The Wizard of Oz'
    ])
  })

  await t.test('GET request to /quotes route', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/quotes'
    })

    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), [
      'You\'re gonna need a bigger boat.',
      'May the Force be with you.',
      'Toto, I\'ve got a feeling we\'re not in Kansas anymore.'
    ])
  })
})
```

## Why Use Platformatic Service?
Beyond Fastify’s functionality, Platformatic Service offers:

- Metrics with [`fastify-metrics`](https://www.npmjs.com/package/fastify-metrics)
- Healthcheck endpoint with [`@fastify/under-pressure`](https://github.com/fastify/under-pressure)
- OpenAPI specification and Scalar with [`@fastify/swagger`](https://www.npmjs.com/package/@fastify/swagger) and [`@scalar/fastify-api-reference`](https://www.npmjs.com/package/@scalar/fastify-api-reference)
- GraphQL API support with [`mercurius`](https://www.npmjs.com/package/mercurius)
- CORS support with [`@fastify/cors`](https://github.com/fastify/fastify-cors)
- Configuration with environment variable validation


## Next Steps 

- [Documentation](../service/overview.md): Explore Platformatic Service in-depth.
- [Discord](https://discord.gg/platformatic): Get help from the Platformatic community. 
- Platformatic [Youtube series](https://www.youtube.com/playlist?list=PL_x4nRdxj60LEXoK5mO-ixOETQTfhqmA7): can help get you up and running building apps with Platformatic open-source tools.
- PLatformatic [Watt](https://docs.platformatic.dev/docs/watt/overview) documentation.

> See the [Platformatic Service Configuration](../service/configuration.md) documentation for all the features which can be configured.




