#! /usr/bin/env node

import commist from 'commist'
import parseArgs from 'minimist'
import isMain from 'es-main'
import helpMe from 'help-me'
import { readFile } from 'fs/promises'
import { join } from 'desm'
import { printAndExitLoadConfigError } from '@platformatic/config'
import { buildCompileCmd } from './lib/compile.js'
import { generateJsonSchemaConfig } from './lib/gen-schema.js'
import { generateTypes } from './lib/gen-types.mjs'
import { createService } from './lib/create.mjs'

import { start, platformaticService } from './index.js'

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
program.register('help start', help.toStdout.bind(null, ['start']))

program.register('start', (argv) => {
  /* c8 ignore next 1 */
  start(platformaticService, argv).catch(printAndExitLoadConfigError)
})

program.register('create', wrapCommand(createService))
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
    console.log('v' + JSON.parse(await readFile(join(import.meta.url, 'package.json'))).version)
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
