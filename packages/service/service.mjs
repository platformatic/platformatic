#! /usr/bin/env node

import commist from 'commist'
import parseArgs from 'minimist'
import isMain from 'es-main'
import helpMe from 'help-me'
import { readFile } from 'fs/promises'
import { join } from 'desm'
import { generateJsonSchemaConfig } from './lib/gen-schema.js'

import { buildCompileCmd } from './lib/compile.js'

import { start, platformaticService } from './index.js'

const help = helpMe({
  dir: join(import.meta.url, 'help'),
  // the default
  ext: '.txt'
})

const program = commist({ maxDistance: 2 })

program.register('help', help.toStdout)
program.register('help start', help.toStdout.bind(null, ['start']))

program.register('start', (argv) => {
  start(platformaticService, argv).catch((err) => {
    /* c8 ignore next 2 */
    console.error(err)
    process.exit(1)
  })
})
program.register('compile', buildCompileCmd(platformaticService))
program.register('schema config', generateJsonSchemaConfig)
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
