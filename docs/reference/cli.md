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
* service - start Platformatic Service; type `platformatic service help` to know more.
* upgrade - upgrade the Platformatic configuration to the latest version.
* gh - creates a new gh action for Platformatic deployments
* deploy - deploy a Platformatic application to the cloud
* runtime - start Platformatic Runtime; type `platformatic runtime help` to know more.
* start - start a Platformatic application
```

### composer

```bash
platformatic composer <command>
```


#### help

Available commands:

* `help` - show this help message.
* `help <command>` - shows more information about a command.
* `start` - start the composer.


#### start

Start the Platformatic Composer with the following command:

``` bash
$ platformatic composer start
```


### db

```bash
platformatic db <command>
```


#### compile

Compile typescript plugins.
``` bash
  $ platformatic db compile
```

As a result of executing this command, the Platformatic DB will compile typescript
plugins in the `outDir` directory.

If not specified, the configuration specified will be loaded from
`platformatic.db.json`, `platformatic.db.yml`, or `platformatic.db.tml` in the current directory.
You can find more details about the configuration format at:
https://oss.platformatic.dev/docs/reference/db/configuration.


#### help

Available commands:

* `help` - show this help message.
* `help <command>` - shows more information about a command.
* `start` - start the server.
* `compile` - compile typescript plugins.
* `seed` - run a seed file.
* `types` - generate typescript types for entities.
* `schema` - generate and print api schema.
* `migrations create` - generate do and undo migration files.
* `migrations apply` - apply migration files.


#### migrations apply

Apply all configured migrations to the database:

``` bash
  $ platformatic db migrations apply
```

The migrations will be applied in the order they are specified in the
folder defined in the configuration file. If you want to apply a specific migration,
you can use the `--to` option:

``` bash
  $ platformatic db migrations apply --to 001
```

Here is an example migration:

``` sql
  CREATE TABLE graphs (
    id SERIAL PRIMARY KEY,
    name TEXT
  );
```

You can always rollback to a specific migration with:

``` bash
  $ platformatic db migrations apply --to VERSION
```

Use 000 to reset to the initial state.

Options:

  * `-c, --config <path>`: Path to the configuration file.
  * `-t, --to <version>`: Migrate to a specific version.

If not specified, the configuration specified will be loaded from
`platformatic.db.json`, `platformatic.db.yml`, or `platformatic.db.tml` in the current directory.
You can find more details about the configuration format at:
https://oss.platformatic.dev/docs/reference/db/configuration.


#### migrations create

Create next migration files

``` bash
  $ platformatic db migrations create
```

It will generate do and undo sql files in the migrations folder. The name of the
files will be the next migration number.

``` bash
  $ platformatic db migrations create --name "create_users_table"
```

Options:

  * `-c, --config <path>`: Path to the configuration file.

If not specified, the configuration specified will be loaded from
`platformatic.db.json`, `platformatic.db.yml`, or `platformatic.db.tml` in the current directory.
You can find more details about the configuration format at:
https://oss.platformatic.dev/docs/reference/db/configuration.


#### migrations

Available commands:

* `migrations create` - generate do and undo migration files.
* `migrations apply` - apply migration files.


#### schema

Update the config schema file:

* `schema config` - update the JSON schema config available on `platformatic.db.schema.json`

Your configuration on `platformatic.db.json` has a schema defined to improve the developer experience and avoid mistakes when updating the configuration of Platformatic DB.
When you run `platformatic db init`, a new JSON `$schema` property is added in `platformatic.db.schema.json`. This can allow your IDE to add suggestions (f.e. mandatory/missing fields, types, default values) by opening the config in `platformatic.db.json`.
Running `platformatic db schema config` you can update your schema so that it matches well the latest changes available on your config.

Generate a schema from the database and prints it to standard output:

* `schema graphql` - generate the GraphQL schema
* `schema openapi` - generate the OpenAPI schema

Options:

  -c, --config FILE  Specify a configuration file to use

If not specified, the configuration specified will be loaded from
`platformatic.db.json`, `platformatic.db.yml`, or `platformatic.db.tml` in the current directory.
You can find more details about the configuration format at:
https://oss.platformatic.dev/docs/reference/db/configuration.


#### seed

Load a seed into the database. This is a convenience method that loads
a JavaScript file and configure @platformatic/sql-mapper to connect to
the database specified in the configuration file.

Here is an example of a seed file:

``` javascript
  'use strict'

  module.exports = async function ({ entities, db, sql }) {
    await entities.graph.save({ input: { name: 'Hello' } })
    await db.query(sql`
      INSERT INTO graphs (name) VALUES ('Hello 2');
    `)
  }
```

You can run this using the `seed` command:

``` bash
  $ platformatic db seed seed.js
```

Options:

  * `--config` - Path to the configuration file.

If not specified, the configuration specified will be loaded from
`platformatic.db.json`, `platformatic.db.yml`, or `platformatic.db.tml` in the current directory.
You can find more details about the configuration format at:
https://oss.platformatic.dev/docs/reference/db/configuration.


#### start

Start the Platformatic DB server with the following command:

``` bash
 $ platformatic db start
 ```

You will need a  configuration file. Here is an example to get you started,
save the following as `platformatic.db.json`:

``` json
  {
    "server": {
      "hostname": "127.0.0.1",
      "port": 0,
      "logger": {
        "level": "info"
      }
    },
    "db": {
      "connectionString": "sqlite://./db"
    },
    "migrations": {
      "dir": "./migrations"
    }
  }
```


Remember to create a migration, run the `db help migrate` command to know more.

All outstanding migrations will be applied to the database unless the
`migrations.autoApply` configuration option is set to false.

By sending the SIGUSR2 signal, the server can be reloaded.

Options:

  -c, --config FILE      Specify a configuration file to use

If not specified, the configuration specified will be loaded from `platformatic.db.json`,
`platformatic.db.yml`, or `platformatic.db.tml` in the current directory. You can find more details about
the configuration format at:
https://oss.platformatic.dev/docs/reference/db/configuration.


#### types

Generate typescript types for your entities from the database.

``` bash
  $ platformatic db types
```

As a result of executing this command, the Platformatic DB will generate a `types`
folder with a typescript file for each database entity. It will also generate a
`global.d.ts` file that injects the types into the Application instance.

In order to add type support to your plugins, you need to install some additional
dependencies. To do this, copy and run an `npm install` command with dependencies
that "platformatic db types" will ask you.

Here is an example of a platformatic plugin.js with jsdoc support.
You can use it to add autocomplete to your code.

``` javascript
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
```

If not specified, the configuration specified will be loaded from
`platformatic.db.json`, `platformatic.db.yml`, or `platformatic.db.tml` in the current directory.
You can find more details about the configuration format at:
https://oss.platformatic.dev/docs/reference/db/configuration.


### runtime

```bash
platformatic runtime <command>
```


#### help

Available commands:

* `help` - show this help message.
* `help <command>` - shows more information about a command.
* `start` - start the runtime.


#### start

Start the Platformatic Runtime with the following command:

``` bash
$ platformatic runtime start
```

### service

```bash
platformatic service <command>
```


#### compile

Compile typescript plugins.
``` bash
  $ platformatic service compile
```

As a result of executing this command, the Platformatic DB will compile typescript
plugins in the `outDir` directory.

If not specified, the configuration specified will be loaded from
`platformatic.service.json`, `platformatic.service.yml`, or `platformatic.service.tml` in the current directory.
You can find more details about the configuration format at:
https://oss.platformatic.dev/docs/reference/service/configuration.


#### help

Available commands:

* `help` - show this help message.
* `help <command>` - shows more information about a command.
* `start` - start the server.
* `schema config` - generate the schema configuration file.


#### schema

Update the config schema file:

* `schema config` - update the JSON schema config available on `platformatic.service.schema.json`

Your configuration on `platformatic.service.json` has a schema defined to improve the developer experience and avoid mistakes when updating the configuration of Platformatic Service.
When you initialize a new Platformatic service (f.e. running `npm create platformatic@latest`), a new JSON `$schema` property is added in the `platformatic.service.json` config. This can allow your IDE to add suggestions (f.e. mandatory/missing fields, types, default values) by opening the config in `platformatic.service.json`.
Running `platformatic service schema config` you can update your schema so that it matches well the latest changes available on your config.




#### start

Start the Platformatic Service with the following command:

``` bash
 $ platformatic service start
 ```

You will need a  configuration file. Here is an example to get you started,
save the following as `platformatic.service.json`:

``` json
{
  "server": {
    "hostname": "127.0.0.1",
    "port": 0,
    "logger": {
      "level": "info"
    }
  },
  "plugin": {
    "path": "./plugin.js"
  }
}
```


### client

```bash
platformatic client <command>
```


#### help

Create a Fastify plugin that exposes a client for a remote OpenAPI or GraphQL API.

To create a client for a remote OpenAPI API, you can use the following command:

```bash
$ platformatic client http://exmaple.com/to/schema/file -n myclient
```

To create a client for a remote Graphql API, you can use the following command:

```bash
$ platformatic client http://exmaple.com/grapqhl -n myclient
```

This will create a Fastify plugin that exposes a client for the remote API in a folder `myclient`
and a file named myclient.js inside it.

If platformatic config file is specified, it will be edited and a `clients` section will be added.
Then, in any part of your Platformatic application you can use the client.

You can use the client in your application in Javascript, calling a GraphQL endpoint:

```js
module.exports = async function (app, opts) {
  app.post('/', async (request, reply) => {
    const res = await app.myclient.graphql({
      query: 'query { hello }'
    })
    return res
  })
}
```

or in Typescript, calling an OpenAPI endpoint:


```ts
import { FastifyInstance } from 'fastify'
/// <reference path="./myclient" />

export default async function (app: FastifyInstance) {
  app.get('/', async () => {
    return app.myclient.get({})
  })
}
```

Options:

  * `-c, --config <path>`: Path to the configuration file.
  * `-n, --name <name>`: Name of the client.

### start

```bash
platformatic start
```


#### help

Start a Platformatic application with the following command:

``` bash
$ platformatic start
```
