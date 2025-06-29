#! /usr/bin/env node

import { printAndExitLoadConfigError } from '@platformatic/config'
import commist from 'commist'
import { join } from 'desm'
import isMain from 'es-main'
import { readFile } from 'fs/promises'
import helpMe from 'help-me'
import parseArgs from 'minimist'
import { buildCompileCmd } from '../lib/compile.js'
import { generateJsonSchemaConfig } from '../lib/gen-schema.js'
import { generateTypes } from '../lib/gen-types.mjs'

import platformaticService from '../index.js'

const help = helpMe({
  dir: join(import.meta.url, 'help'),
  // the default
  ext: '.txt'
})

function wrapCommand (fn) {
  return async function (...args) {
    try {
      return await fn(...args)
      /* c8 ignore next 3 */
    } catch (err) {
      printAndExitLoadConfigError(err)
    }
  }
}

const program = commist({ maxDistance: 2 })

program.register('help', help.toStdout)
program.register('compile', buildCompileCmd(platformaticService))
program.register('types', wrapCommand(generateTypes))
program.register('schema config', wrapCommand(generateJsonSchemaConfig))
program.register('schema', help.toStdout.bind(null, ['schema']))

export async function runService (argv) {
  const args = parseArgs(argv, {
    alias: {
      v: 'version'
    }
  })

  /* c8 ignore next 4 */
  if (args.version) {
    console.log('v' + JSON.parse(await readFile(join(import.meta.url, '../package.json'), 'utf-8')).version)
    process.exit(0)
  }

  return {
    output: await program.parseAsync(argv),
    help
  }
}

if (isMain(import.meta)) {
  await runService(process.argv.splice(2))
}
