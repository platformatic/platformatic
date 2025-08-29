import { applyMigrations, helpFooter as applyMigrationsFooter } from './migrations-apply.js'
import { createMigrations, helpFooter as createMigrationsFooter } from './migrations-create.js'
import { printSchema } from './print-schema.js'
import { seed, helpFooter as seedFooter } from './seed.js'
import { generateTypes, helpFooter as typesFooter } from './types.js'

export function createCommands (id) {
  return {
    commands: {
      [`${id}:migrations:create`]: createMigrations,
      [`${id}:migrations:apply`]: applyMigrations,
      [`${id}:seed`]: seed,
      [`${id}:types`]: generateTypes,
      [`${id}:schema`]: printSchema
    },
    help: {
      [`${id}:migrations:create`]: {
        usage: `${id}:migrations:create`,
        description: 'Create a new migration file',
        footer: createMigrationsFooter
      },
      [`${id}:migrations:apply`]: {
        usage: `${id}:migrations:apply`,
        description: 'Apply all configured migrations to the database',
        footer: applyMigrationsFooter,
        options: [
          {
            usage: '-r, --rollback',
            description: 'Rollback migrations instead of applying them'
          },
          {
            usage: '-t, --to <version>',
            description: 'Migrate to a specific version'
          }
        ]
      },
      [`${id}:seed`]: {
        usage: `${id}:seed [file]`,
        description: 'Load a seed into the database',
        footer: seedFooter,
        args: [
          {
            name: 'file',
            description: 'The seed file to load.'
          }
        ]
      },
      [`${id}:types`]: {
        usage: `${id}:types`,
        description: 'Generate TypeScript types for your entities from the database',
        footer: typesFooter
      },
      [`${id}:schema`]: {
        usage: `${id}:schema [openapi|graphql]`,
        description: 'Prints the OpenAPI or GraphQL schema for the database'
      }
    }
  }
}
