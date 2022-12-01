#! /usr/bin/env node

import commist from 'commist'
import parseArgs from 'minimist'
import isMain from 'es-main'
import helpMe from 'help-me'
import { readFile } from 'fs/promises'
import { join } from 'desm'

import start from './lib/start.mjs'
import { compile } from './lib/compile.js'
import { init } from './lib/init.mjs'

const help = helpMe({
  dir: join(import.meta.url, 'help'),
  // the default
  ext: '.txt'
})

const program = commist({ maxDistance: 4 })

program.register('help', help.toStdout)
program.register('help start', help.toStdout.bind(null, ['start']))

program.register('init', init)
program.register('start', start)
program.register('compile', compile)

export async function runService (argv) {
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
    return start(result)
  }
}

if (isMain(import.meta)) {
  await runService(process.argv.splice(2))
}
