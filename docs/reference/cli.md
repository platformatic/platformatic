---
toc_max_heading_level: 4
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import TOCInline from '@theme/TOCInline';

# Platformatic CLI

## Installation and usage

Install the Platformatic CLI as a dependency for your project:

<Tabs groupId="package-manager">
<TabItem value="npm" label="npm">

```bash
npm install platformatic
```

</TabItem>
<TabItem value="yarn" label="Yarn">

```bash
yarn add platformatic
```

</TabItem>
<TabItem value="pnpm" label="pnpm">

```bash
pnpm add platformatic
```

</TabItem>
</Tabs>

Once it's installed you can run it with:

<Tabs groupId="package-manager">
<TabItem value="npm" label="npm">

```bash
npx platformatic
```

</TabItem>
<TabItem value="yarn" label="Yarn">

```bash
yarn platformatic
```

</TabItem>
<TabItem value="pnpm" label="pnpm">

```bash
pnpm platformatic
```

</TabItem>
</Tabs>

:::info

The `platformatic` package can be installed globally, but installing it as a
project dependency ensures that everyone working on the project is using the
same version of the Platformatic CLI.

:::

## Commands

The Platformatic CLI provides the following commands:

<TOCInline toc={toc} minHeadingLevel={3} maxHeadingLevel={4} />

### help


```
Welcome to Platformatic. Available commands are:

* help - Display this message
* help <command> - shows more information about a command.
* db - start Platformatic DB; type `platformatic db help` to know more.
```


### db

```bash
platformatic db <command>
```


#### compile

Compile typescript plugins.

  $ platformatic db compile

As a result of executing this command, the Platformatic DB will compile typescript
plugins in the `outDir` directory. 

If not specified, the configuration specified will be loaded from
`platformatic.db.json`, `platformatic.db.yml`, or `platformatic.db.tml` in the current directory.
You can find more details about the configuration format at:
https://oss.platformatic.dev/docs/reference/configuration.

  
#### help

Available commands:

* `help` - show this help message.
* `help <command>` - shows more information about a command.
* `init` - initiate default application.
* `start` - start the server.
* `compile` - compile typescript plugins.
* `migrate` - run migrations.
* `seed` - run a seed file.
* `types` - generate typescript types for entities.
* `schema` - generate and print api schema.

  
#### init

Initiate default Platformatic DB application:

  $ platformatic db init

As a result of executing this command, the `platformatic.db.json` configuration
file and the `migrations` folder with migration examples will be generated.

Options:

  * `-h, --hostname <hostname>`: The hostname where Platformatic DB server will listen for connections.
  * `-p, --port <port>`: The port where Platformatic DB server will listen for connections.
  * `-db, --database <database_name>`: The name of the database to use. Default: `sqlite`. 
  * `-m, --migrations <path>`: Relative path to the migrations folder. Default: `./migrations`.
  * `-t, --types <boolean>`: Set true to enable type autogeneration. Default: `true`.
  * `-ts` --typescript <boolean>`: Set true to enable TypeScript plugins. Default: `false`.

  
#### migrate

Apply all configurated migrations to the database:

  $ platformatic db migrate

The migrations will be applied in the order they are specified in the
folder defined in the configuration file. If you want to apply a specific migration,
you can use the `--to` option:

  $ platformatic db migrate --to 001

Here is an example migration:

  CREATE TABLE graphs (
    id SERIAL PRIMARY KEY,
    name TEXT
  );

You can always rollback to a specific migration with:

  $ platformatic db migrate --to VERSION

Use 000 to reset to the initial state.

Options:

  * `-c, --config <path>`: Path to the configuration file.
  * `-t, --to <version>`: Migrate to a specific version.

If not specified, the configuration specified will be loaded from
`platformatic.db.json`, `platformatic.db.yml`, or `platformatic.db.tml` in the current directory.
You can find more details about the configuration format at:
https://oss.platformatic.dev/docs/reference/configuration.

  
#### schema

Generate a schema from the database and prints it to standard output:

* `schema graphql` - generate the GraphQL schema
* `schema openapi` - generate the OpenAPI schema

Options:

  -c, --config FILE  Specify a configuration file to use

If not specified, the configuration specified will be loaded from
`platformatic.db.json`, `platformatic.db.yml`, or `platformatic.db.tml` in the current directory.
You can find more details about the configuration format at:
https://oss.platformatic.dev/docs/reference/configuration.

  
#### seed

Load a seed into the database. This is a convenience method that loads
a JavaScript file and configure @platformatic/sql-mapper to connect to
the database specified in the configuration file.

Here is an example of a seed file:

  'use strict'

  module.exports = async function ({ entities, db, sql }) {
    await entities.graph.save({ input: { name: 'Hello' } })
    await db.query(sql`
      INSERT INTO graphs (name) VALUES ('Hello 2');
    `)
  }

You can run this using the `seed` command:

  $ platformatic db seed seed.js

Options:

  * `--config` - Path to the configuration file.

If not specified, the configuration specified will be loaded from
`platformatic.db.json`, `platformatic.db.yml`, or `platformatic.db.tml` in the current directory.
You can find more details about the configuration format at:
https://oss.platformatic.dev/docs/reference/configuration.

  
#### start

Start the Platformatic DB server with the following command:

 $ platformatic db start

You will need a  configuration file. Here is an example to get you started,
save the following as `platformatic.db.json`:

  {
    "server": {
      "hostname": "127.0.0.1",
      "port": 0,
      "logger": {
        "level": "info"
      }
    },
    "core": {
      "connectionString": "sqlite://./db"
    },
    "migrations": {
      "dir": "./migrations"
    }
  }


Remeber to create a migration, run the `db help migrate` command to know more.

All outstanding migrations will be applied to the database unless the
`migrations.autoApply` configuration option is set to false.

By sending the SIGUSR2 signal, the server can be reloaded.

Options:

  -c, --config FILE     Specify a configuration file to use
  --watch-ignore LIST   Specify a comma separated list of glob patterns to
                        ignore when watching for changes

If not specified, the configuration specified will be loaded from `platformatic.db.json`,
`platformatic.db.yml`, or `platformatic.db.tml` in the current directory. You can find more details about
the configuration format at:
https://oss.platformatic.dev/docs/reference/configuration.

  
#### types

Generate typescript types for your entities from the database.

  $ platformatic db types

As a result of executing this command, the Platformatic DB will generate a `types`
folder with a typescript file for each database entity. It will also generate a
`global.d.ts` file that injects the types into the Application instance.

In order to add type support to your plugins, you need to install some additional
dependencies. To do this, copy and run an `npm install` command with dependencies
that "platformatic db types" will ask you.

Here is an example of a platformatic plugin.js with jsdoc support.
You can use it to add autocomplete to your code.

/// <reference path="./global.d.ts" />
'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  app.get('/movie', async () => {
    const movies = await app.platformatic.entities.movie.find({
      where: { title: { eq: 'The Hitchhiker\'s Guide to the Galaxy' } }
    })
    return movies[0].id
  })
}

If not specified, the configuration specified will be loaded from
`platformatic.db.json`, `platformatic.db.yml`, or `platformatic.db.tml` in the current directory.
You can find more details about the configuration format at:
https://oss.platformatic.dev/docs/reference/configuration.

  