#! /usr/bin/env node

import { readFile } from 'fs/promises'

import commist from 'commist'
import parseArgs from 'minimist'
import isMain from 'es-main'
import helpMe from 'help-me'
import { join } from 'desm'
import { start } from '@platformatic/service'
import { printAndExitLoadConfigError } from '@platformatic/config'

import { fetchOpenApiSchemas } from './lib/fetch-schemas.mjs'
import { platformaticComposer } from './index.js'

const help = helpMe({
  dir: join(import.meta.url, 'help'),
  // the default
  ext: '.txt'
})

const program = commist({ maxDistance: 2 })

program.register('start', (argv) => {
  /* c8 ignore next 1 */
  start(platformaticComposer, argv).catch(printAndExitLoadConfigError)
})
program.register('openapi schemas fetch', (argv) => {
  return fetchOpenApiSchemas(argv).catch(printAndExitLoadConfigError)
})

export async function runComposer (argv) {
  const args = parseArgs(argv, {
    alias: {
      v: 'version'
    }
  })

  if (args.version) {
    console.log('v' + JSON.parse(await readFile(join(import.meta.url, 'package.json'))).version)
    process.exit(0)
  }

  const output = await program.parseAsync(argv)

  return {
    output,
    help
  }
}

if (isMain(import.meta)) {
  await runComposer(process.argv.splice(2))
}
