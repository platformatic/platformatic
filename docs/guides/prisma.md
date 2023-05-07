# Integrate Prisma with Platformatic DB

[Prisma](https://www.prisma.io/) is an open-source ORM for Node.js and TypeScript. It is used as an alternative to writing SQL, or using another database access tool such as SQL query builders (like [knex.js](https://knexjs.org/)) or ORMs (like [TypeORM](https://typeorm.io/) and [Sequelize](https://sequelize.org/)). Prisma currently supports PostgreSQL, MySQL, SQL Server, SQLite, MongoDB, and CockroachDB.

Prisma can be used with JavaScript or TypeScript, and provides a level to type-safety that goes beyond the guarantees made by other ORMs in the TypeScript ecosystem. You can find an in-depth comparison of Prisma against other ORMs [here](https://www.prisma.io/docs/concepts/more/comparisons).

If you want to get a quick overview of how Prisma works, you can follow the [Quickstart](https://www.prisma.io/docs/getting-started/quickstart) or read the [Introduction](https://www.prisma.io/docs/understand-prisma/introduction) in the Prisma documentation. 


## How Prisma can improve your workflow with Platformatic DB

While Platformatic speeds up development of your REST and GraphQL APIs, Prisma can complement the workflow in several ways:

1. Provides an intuitive data modeling language
1. Provides auto-generated and customizable SQL migrations
1. Provides type-safety and auto-completion for your database queries


You can learn more about why Prisma and Platformatic are a great match [this article](https://dev.to/prisma/why-prisma-and-platformatic-are-a-great-match-2dkl).

## Prerequisites

To follow along with this guide, you will need to have the following:
- [Node.js](https://nodejs.org/) >= v16.17.0 or >= v18.8.0
- [npm](https://docs.npmjs.com/cli/) v7 or later
- A code editor, for example [Visual Studio Code](https://code.visualstudio.com/)
- A Platformatic DB project

## Setup Prisma

Install the [Prisma CLI](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-cli) and the [`db-diff`](https://github.com/ruheni/db-diff) development dependencies in your project:

```bash
npm install --save-dev prisma @ruheni/db-diff
```

Next, initialize Prisma in your project

```bash
npx prisma init
```

This command does the following:

- Creates a new directory called `prisma` which contains a file called `schema.prisma`. This file defines your database connection and the Prisma Client generator.
- Creates a `.env` file at the root of your project if it doesn't exist. This defines your environment variables (used for your database connection).

You can specify your preferred database provider using the `--datasource-provider` flag, followed by the name of the provider: 

```bash
npx prisma init --datasource-provider postgresql # or sqlite, mysql, sqlserver, cockroachdb
```

Prisma uses the `DATABASE_URL` environment variable to connect to your database to sync your database and Prisma schema. It also uses the variable to connect to your database to run your Prisma Client queries. 

If you're using PostgreSQL, MySQL, SQL Server, or CockroachDB, ensure that the `DATABASE_URL` used by Prisma is the same as the one used by Platformatic DB project. If you're using SQLite, refer to the [Using Prisma with SQLite](#using-prisma-with-sqlite) section.

If you have an existing project, refer to the [Adding Prisma to an existing Platformatic DB project](#adding-prisma-to-an-existing-project) section. If you're adding Prisma to a new project, refer to the [Adding Prisma to a new project](#adding-prisma-to-a-new-project).

## Adding Prisma to an existing project

If you have an existing Platformatic DB project, you can introspect your database and generate the data model in your Prisma schema with the following command:

```bash
npx prisma db pull
```

The command will introspect your database and generate the [data model](https://www.prisma.io/docs/concepts/components/prisma-schema/data-model)

Next, add the `@@ignore` attribute to the `versions` model to exclude it from the Prisma Client API:

```diff
model versions {
  version BigInt    @id
  name    String?
  md5     String?
  run_at  DateTime? @db.Timestamptz(6)

+  @@ignore
}
```

To learn how you can evolve your database schema, you can jump to the [Evolving your database schema](#evolving-your-database-schema) section.

## Adding Prisma to a new project

Define a `Post` model with the following fields at the end of your `schema.prisma` file:
```groovy title="prisma/schema.prisma"
model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  viewCount Int      @default(0)
  createdAt DateTime @default(now())

  @@map("posts")
}
```

The snippet above defines a `Post` model with the following fields and properties:
- `id`: An auto-incrementing integer that will be the primary key for the model.
- `title`: A non-nullable `String` field.
- `content`: A nullable `String` field.
- `published`: A `Boolean` field with a default value of false.
- `viewCount`: An `Int` field with a default value of 0.
- `createdAt`: A `DateTime` field with a timestamp of when the value is created as its default value.

By default, Prisma maps the model name and its format to the table name — which is also used im Prisma Client. Platformatic DB uses a snake casing and pluralized table names to map your table names to the generated API. The `@@map()` attribute in the Prisma schema allows you to define the name and format of your table names to be used in your database. You can also use the `@map()` attribute to define the format for field names to be used in your database. Refer to the [Foreign keys and table names naming conventions](#foreign-keys-and-table-names-naming-conventions) section to learn how you can automate formatting foreign keys and table names.

Next, run the following command to generate an up and down migration:

```bash
npx db-diff
```

The previous command will generate both an `up` and `down` migration based on your schema. The generated migration is stored in your `./migrations` directory. If you are currently using a different path to store the migration, you can provide the `--migrations-dir` flag followed by the path.

You can then apply the generated migration using the Platformatic DB CLI:

```bash
npx platformatic db migrations apply
```

Platformatic uses [Postgrator](https://www.npmjs.com/package/postgrator) to run migrations. Postgrator creates a table in the database called `versions` to track the applied migrations. Since the `versions` table is not yet captured in the Prisma schema, run the following command to introspect the database and populate it with the missing model:

```
npx prisma db pull
```

Introspecting the database to populate the model prevents including the `versions` table in the generated down migrations.

Your Prisma schema should now contain a `versions` model that is similar to this one (it will vary depending on the database system you're using):

```diff
model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  viewCount Int      @default(0)
  createdAt DateTime @default(now())

  @@map("posts")
}

+model versions {
+  version BigInt    @id
+  name    String?
+  md5     String?
+  run_at  DateTime? @db.Timestamptz(6)
+}
```


Add the `@@ignore` attribute function to the model to exclude it from the Prisma Client API:

```diff
model versions {
  version BigInt    @id
  name    String?
  md5     String?
  run_at  DateTime? @db.Timestamptz(6)

+  @@ignore
}
```
### Evolving your database schema

Update the data model in your Prisma schema by adding a model or a field:

```diff
// based on the schema in the "Adding Prisma to a new project" section
+model User {
+  id    Int     @id @default(autoincrement())
+  email String  @unique
+  name  String?
+  posts Post[]
+
+  @@map("users")
+}

model Post {
  id        Int      @id @default(autoincrement())
  createdAt DateTime @default(now())
  title     String
  content   String?
  published Boolean  @default(false)
  viewCount Int      @default(0)
+  author    User?    @relation(fields: [authorId], references: [id])
+  authorId  Int?     @map("author_id")

  @@map("posts")
}

```

Next, use the `@ruheni/db-diff` CLI tool to generate `up` and `down` migrations:

```bash
npx db-diff
```

This command will generate up and down migrations based off of your Prisma schema. If you are currently using a different path to store the migration, you can provide the `--migrations-dir` flag followed by the path.

Next, apply the generated migration using the Platformatic CLI:

```bash
npx platformatic db migrations apply
```

And you're done!

## Using Prisma Client in your plugins

Plugins allow you to add custom functionality to your REST and GraphQL API. Refer to the [Add Custom Functionality](/docs/guides/add-custom-functionality/introduction.md) to learn more how you can add custom functionality.


:::danger

Prisma Client usage with Platformatic is currently only supported in Node v18 

:::

You can use Prisma Client to interact with your database in your plugin. 

To get started, run the following command:

```bash
npx prisma generate
```

The above command installs the `@prisma/client` in your project and generates a Prisma Client based off of your Prisma schema.

Install [`@sabinthedev/fastify-prisma`](https://github.com/sabinadams/fastify-prisma) fastify plugin. The plugin takes care of shutting down database connections and makes Prisma Client available as a Fastify plugin.

```bash
npm install @sabinthedev/fastify-prisma
```

Register the plugin and extend your REST API:

```js
// 1. 
const prismaPlugin = require("@sabinthedev/fastify-prisma")

module.exports = async (app) => {
  app.log.info('plugin loaded')
  
  // 2. 
  app.register(prismaPlugin)
  
  /** 
   * Plugin logic
   */
    // 3.
    app.put('/post/:id/views', async (req, reply) => {
  
    const { id } = req.params
    
    // 4.
    const post = await app.prisma.post.update({
      where: {
        id: Number(id)
      },
      data: {
        viewCount: {
          increment: 1
        }
      }
    })
    
    // 5.
    return reply.send(post)
  })
}
```

The snippet does the following:
1. Imports the plugin
1. Registers the `@sabinthedev/fastify-prisma`
1. Defines the endpoint for incrementing the views of a post
1. Makes a query to the database on the Post model to increment a post's view count
1. Returns the updated post on success


If you would like to extend your GraphQL API, extend the schema and define the corresponding resolver:

```js title="plugin.js"
// ./plugin.js
const prismaPlugin = require("@sabinthedev/fastify-prisma")

module.exports = async (app) => {
  app.log.info('plugin loaded')

  app.graphql.extendSchema(`
    extend type Mutation {
      incrementPostViewCount(id: ID): Post
    }
  `)

  app.graphql.defineResolvers({
    Mutation: {
      incrementPostViewCount: async (_, { id }) => {
        const post = await prisma.post.update({
          where: {
            id: Number(id)
          },
          data: {
            viewCount: {
              increment: 1
            }
          }
        })

        if (!post) throw new Error(`Post with id:${id} was not found`)
        return post
      }
    }
  })
}
```

Start the server: 

```bash
npx platformatic db start
```

The query should now be included in your GraphQL schema.

You can also use the Prisma Client in your REST API endpoints.

## Workarounds

### Using Prisma with SQLite

Currently, Prisma doesn't resolve the file path of a SQLite database the same way as Platformatic does. 

If your database is at the root of the project, create a new environment variable that Prisma will use called `PRISMA_DATABASE_URL`:

```bash
# .env
DATABASE_URL="sqlite://db.sqlite"
PRISMA_DATABASE_URL="file:../db.sqlite"
```

Next, update the `url` value in the `datasource` block in your Prisma schema with the updated value:

```groovy title="prisma/schema.prisma"
// ./prisma/schema.prisma
datasource db {
  provider = "sqlite"
  url      = env("PRISMA_DATABASE_URL")
}
```

Running migrations should now work smoothly and the path will be resolved correctly.

### Foreign keys, field, and table names naming conventions

Foreign key names should use underscores, e.g. `author_id`, for Platformatic DB to correctly map relations. You can use the `@map("")` attribute to define the names of your foreign keys and field names to be defined in the database.

Table names should be mapped to use the naming convention expected by Platformatic DB e.g. `@@map("recipes")` (the Prisma convention is Recipe, which corresponds with the model name).

You can use [`prisma-case-format`](https://github.com/iiian/prisma-case-format) to enforce your own database conventions, i.e., pascal, camel, and snake casing.
 
## Learn more

If you would like to learn more about Prisma, be sure to check out the [Prisma docs](https://www.prisma.io/docs).
