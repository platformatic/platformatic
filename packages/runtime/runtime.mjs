#! /usr/bin/env node

import { readFile } from 'node:fs/promises'
import commist from 'commist'
import { join } from 'desm'
import isMain from 'es-main'
import helpMe from 'help-me'
import parseArgs from 'minimist'
import { start } from './lib/start.js'
import { compile } from './lib/compile.js'

const help = helpMe({
  dir: join(import.meta.url, 'help'),
  // the default
  ext: '.txt'
})

const program = commist({ maxDistance: 2 })

program.register('help', help.toStdout)
program.register('help start', help.toStdout.bind(null, ['start']))
program.register('help compile', help.toStdout.bind(null, ['compile']))
program.register('start', start)
program.register('compile', compile)

export async function run (argv) {
  const args = parseArgs(argv, {
    alias: {
      v: 'version'
    }
  })

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
  await run(process.argv.splice(2))
}
