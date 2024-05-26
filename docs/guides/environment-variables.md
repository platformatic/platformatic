import NewApiProjectInstructions from '../getting-started/new-api-project-instructions.md';

# Using Environment Variables with Platformatic

Applications built with Platformatic loosely follows [the twelve factor app methodology](https://12factor.net/).
This guide will show how to make your application [configurable](https://12factor.net/config), while
keeping your deployment environments as close as possible.

## Environment Variables replacement

In any Platformatic configuration file, you can always interpolate an environment variable inside a value:

```json
{
  ...
  "db": {
    "connectionString": "{DATABASE_URL}"
  }
  ...
}
```

The replacement is done via [`pupa`](http://npm.im/pupa), after the JSON file is parsed.

All Platformatic configuration files support Environment Variables replacement, i.e.
env variables are supported in Platformatic Service, Platformatic DB, Platformatic Composer, Platformatic Runtime.

### dotenv support

[`dotenv`](http://npm.im/dotenv) is built in inside Platformatic, allowing you to create an envfile with
all your environment variables, that is loaded automatically by Platformatic at startup.
If a `.env` file exists it will automatically be loaded by Platformatic using
[`dotenv`](https://github.com/motdotla/dotenv). For example:

```plaintext title=".env"
DATABASE_URL=sqlite://./db.sqlite
```

The `.env` file must be located in the same folder as the Platformatic configuration
file or in the current working directory.

Environment variables can also be set directly on the command line, for example:

```bash
PLT_SERVER_LOGGER_LEVEL=debug npx platformatic start
```

## Adding a custom environment variable to a project

### Create a Platformatic DB App

<NewApiProjectInstructions/>

This same tutorial applies to all other Platformatic tools.

### Modify `platformatic.db.json`

Add a `greeting` option inside your `plugins` configuration:

```json
{
  ...
  "plugins": {
    "paths": [
      {
        "path": "./plugins",
        "encapsulate": false,
        "options": {
          "greeting": "{PLT_GREETING}"
        }
      },
      {
        "path": "./routes"
      }
    ]
  },
  ...
}
```

This new options will be available inside all the options passed to
all plugins in the `plugins/` folder.

### Decorate the Fastify instance

Create a new `plugins/greeting.js` file, calling [fastify.decorate()](https://fastify.dev/docs/latest/Reference/Decorators/#decorators)
to expose some functionality to other plugins:

```js
/// <reference path="../global.d.ts" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.decorate('sayHello', sayHello)

  function sayHello (name) {
    return `${opts.greeting} ${name}`
  }
}
```

### Use it inside a route

Create a new `routes/hello.js` file that uses the newly added functionality, like so:

```js
/// <reference path="../global.d.ts" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.get('/hello', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      },
      required: ['name']
    }
  }, async (request, reply) => {
    return fastify.sayHello(request.query.name)
  })
}
```

### Add an environemnt variable

Edit your `.env` file and add:

```
PLT_GREETING=Hello
```

Don't forget to add a default value to your `.env.sample`, as
the `.env` file is not committed to the repository.

### Run your application and test the new route

Run your application with `npm start`, and then test the new route with:

```bash
curl 'http://localhost:3042/hello?name=matteo'
```
