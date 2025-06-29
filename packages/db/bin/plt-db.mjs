#! /usr/bin/env node

import { printAndExitLoadConfigError } from '@platformatic/config'
import commist from 'commist'
import { join } from 'desm'
import isMain from 'es-main'
import { readFile } from 'fs/promises'
import helpMe from 'help-me'
import parseArgs from 'minimist'
import { createDB } from '../lib/create.mjs'
import { generateMigration } from '../lib/gen-migration.mjs'
import { generateJsonSchemaConfig, printGraphQLSchema, printOpenAPISchema } from '../lib/gen-schema.mjs'
import { generateTypes } from '../lib/gen-types.mjs'
import { applyMigrations } from '../lib/migrate.mjs'
import { seed } from '../lib/seed.mjs'

const help = helpMe({
  dir: join(import.meta.url, './help'),
  // the default
  ext: '.txt'
})

function wrapCommand (fn) {
  return async function (...args) {
    try {
      return await fn(...args)
    } catch (err) {
      printAndExitLoadConfigError(err)
    }
  }
}

const program = commist({ maxDistance: 2 })

program.register('help', help.toStdout)
program.register('help migrations apply', help.toStdout.bind(null, ['migrations apply']))
program.register({ command: 'help seed', strict: true }, help.toStdout.bind(null, ['seed']))
program.register('help schema', help.toStdout.bind(null, ['schema']))
program.register('create', wrapCommand(createDB))
program.register('migrations create', wrapCommand(generateMigration))
program.register('migrations apply', wrapCommand(applyMigrations))
program.register('seed', wrapCommand(seed))
program.register('types', wrapCommand(generateTypes))
program.register('schema graphql', wrapCommand(printGraphQLSchema))
program.register('schema openapi', wrapCommand(printOpenAPISchema))
program.register('schema config', wrapCommand(generateJsonSchemaConfig))
program.register('schema', help.toStdout.bind(null, ['schema']))

export async function runDB (argv) {
  const args = parseArgs(argv, {
    alias: {
      v: 'version'
    }
  })

  if (args.version) {
    console.log('v' + JSON.parse(await readFile(join(import.meta.url, '../package.json'), 'utf-8')).version)
    process.exit(0)
  }

  const output = await program.parseAsync(argv)

  return {
    output,
    help
  }
}

if (isMain(import.meta)) {
  await runDB(process.argv.splice(2))
}
