#! /usr/bin/env node

import { printAndExitLoadConfigError } from '@platformatic/config'
import commist from 'commist'
import { join } from 'desm'
import isMain from 'es-main'
import { readFile } from 'fs/promises'
import helpMe from 'help-me'
import parseArgs from 'minimist'
import { fetchOpenApiSchemas } from '../lib/openapi-fetch-schemas.mjs'

const help = helpMe({
  dir: join(import.meta.url, 'help'),
  // the default
  ext: '.txt'
})

const program = commist({ maxDistance: 2 })

program.register('openapi schemas fetch', argv => {
  return fetchOpenApiSchemas(argv).catch(printAndExitLoadConfigError)
})

export async function runComposer (argv) {
  const args = parseArgs(argv, {
    alias: {
      v: 'version'
    }
  })

  if (args.version) {
    console.log('v' + JSON.parse(await readFile(join(import.meta.url, 'package.json'), 'utf-8')).version)
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
