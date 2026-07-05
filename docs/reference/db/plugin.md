import Issues from '../../getting-started/issues.md';

# Plugin

If you want to extend Platformatic DB features, it is possible to register a plugin, which will be in the form of a standard [Fastify](https://fastify.io) plugin.

The config file will specify where the plugin file is located as the example below:

```json
{
  ...
  "plugins": {
    "paths": ["./plugin/index.js"]
  }
}
```

The paths are relative to the config file path.

Once the config file is set up, you can write your plugin to extend Platformatic DB API or write your custom business logic.

You should export an async `function` which receives a parameters:

- `app` (`FastifyInstance`) the main Fastify [instance](https://www.fastify.io/docs/latest/Reference/Server/#instance) running Platformatic DB.
- `opts` all the options specified in the config file after `path`.

You can always access Platformatic [data mapper](../sql-mapper/overview.md) through `app.platformatic` property.

## Context Integration in Plugin Operations

To ensure robust authorization and data management, it's important to pass the `context` object to the `entity mapper`. This `context` includes user-specific data, permissions, and other parameters that influence how data operations are executed.

Here's how you can integrate context into your plugin:

```js
app.post('/', async (req, reply) => {
  const ctx = req.platformaticContext

  await app.platformatic.entities.movies.find({
    where: {
      /*...*/
    },
    ctx
  })
})
```

## Running Custom SQL Queries

Besides the generated entities, plugins can run any SQL query through `app.platformatic.db` and the `app.platformatic.sql` template tag, which safely interpolates values as query parameters:

```js
export default async function (app) {
  app.get('/most-quoted-movies', async (req, reply) => {
    const { db, sql } = app.platformatic
    const limit = 10

    return db.query(sql`
      SELECT movies.title, COUNT(quotes.id) AS quotes
      FROM movies
      JOIN quotes ON quotes.movie_id = movies.id
      GROUP BY movies.title
      ORDER BY quotes DESC
      LIMIT ${limit}
    `)
  })
}
```

Never concatenate user input into the query string: always interpolate values with the `sql` tag (or use `sql.ident` for identifiers) so they are passed as bound parameters.

Queries can also participate in transactions through `app.platformatic.db.tx`:

```js
await app.platformatic.db.tx(async tx => {
  await tx.query(sql`UPDATE accounts SET balance = balance - 100 WHERE id = ${from}`)
  await tx.query(sql`UPDATE accounts SET balance = balance + 100 WHERE id = ${to}`)
})
```

For the complete query API, see the [@databases documentation](https://www.atdatabases.org/), which Platformatic DB uses under the hood.

## Hot Reload

Plugin files are monitored by the [`fs.watch`](https://nodejs.org/api/fs.html#fspromiseswatchfilename-options) function.

You don't need to reload Platformatic DB server while working on your plugin. Every time you save, the watcher will trigger a reload event and the server will auto-restart and load your updated code.

:::tip

At this time, on Linux, file watch in subdirectories is not supported due to a Node.js limitation (documented [here](https://nodejs.org/api/fs.html#caveats)).

:::

## Directories

The path can also be a directory. In that case, the directory will be loaded with [`@fastify/autoload`](https://github.com/fastify/fastify-autoload).

Consider the following directory structure:

```
├── routes
│   ├── foo
│   │   ├── something.js
│   │   └── bar
│   │       └── baz.js
│   ├── single-plugin
│   │   └── utils.js
│   └── another-plugin.js
└── platformatic.service.json
```

By default, the folder will be added as a prefix to all the routes defined within them.
See the [autoload documentation](../runtime/configuration.md#autoload) for all the options to customize this behavior.

## Multiple plugins

Multiple plugins can be loaded in parallel by specifying an array:

```json
{
  ...
  "plugins": {
    "paths": [{
      "path": "./plugin/index.js"
    }, {
      "path": "./routes/"
    }]
  }
}
```

## TypeScript and autocompletion

If you want to access any of the types provided by Platformatic DB, generate them using the Watt's `$db:types` command (where `$db` is the id of your Platformatic DB service).
This will create a `plt-env.d.ts` file that add Platformatic types to fastify instances. This file is included automatically
by Typescript, unless you have the `includes` option set in your `tsconfig.json`. In that case you need to add
`plt-env.d.ts` to the `include` list manually.

### Plugin definition with TypeScript

Here is an example of writing a plugin in TypeScript:

```ts
import { type FastifyInstance, type FastifyPluginOptions } from 'fastify'

export default async function  (fastify: FastifyInstance, opts: FastifyPluginOptions) {}
```

<Issues />
