#! /usr/bin/env node

import commist from 'commist'
import parseArgs from 'minimist'
import isMain from 'es-main'
import helpMe from 'help-me'
import { readFile } from 'fs/promises'
import { join } from 'desm'

import start from './lib/start.mjs'
import { init } from './lib/init.mjs'
import { compile } from './lib/compile.mjs'
import { applyMigrations } from './lib/migrate.mjs'
import { seed } from './lib/seed.mjs'
import { generateTypes } from './lib/gen-types.mjs'
import { printGraphQLSchema, printOpenAPISchema, generateJsonSchemaConfig } from './lib/gen-schema.mjs'

const help = helpMe({
  dir: join(import.meta.url, 'help'),
  // the default
  ext: '.txt'
})

const program = commist({ maxDistance: 2 })

program.register('help', help.toStdout)
program.register('help init', help.toStdout.bind(null, ['init']))
program.register('help start', help.toStdout.bind(null, ['start']))
program.register('help migrations apply', help.toStdout.bind(null, ['migrations apply']))
program.register({ command: 'help seed', strict: true }, help.toStdout.bind(null, ['seed']))
program.register('help schema', help.toStdout.bind(null, ['schema']))

program.register('start', start)
program.register('init', init)
program.register('compile', compile)
program.register('migrations apply', applyMigrations)
program.register('seed', seed)
program.register('types', generateTypes)
program.register('schema graphql', printGraphQLSchema)
program.register('schema openapi', printOpenAPISchema)
program.register('schema config', generateJsonSchemaConfig)
program.register('schema', help.toStdout.bind(null, ['schema']))

// TODO add help command

export async function runDB (argv) {
  const args = parseArgs(argv, {
    alias: {
      v: 'version'
    }
  })

  if (args.version) {
    console.log('v' + JSON.parse(await readFile(join(import.meta.url, 'package.json'))).version)
    process.exit(0)
  }

  const result = program.parse(argv)

  if (result) {
    // We did have a command we did not match
    console.log('Command not found:', result.join(' '), '\n')
    await help.toStdout()

    process.exit(1)
  }
}

if (isMain(import.meta)) {
  await runDB(process.argv.splice(2))
}
