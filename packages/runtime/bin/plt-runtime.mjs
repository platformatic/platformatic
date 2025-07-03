#! /usr/bin/env node

import commist from 'commist'
import { join } from 'desm'
import isMain from 'es-main'
import helpMe from 'help-me'
import parseArgs from 'minimist'
import { readFile } from 'node:fs/promises'
import { compile as compileCmd } from '../lib/compile.js'

export const compile = compileCmd

const help = helpMe({
  dir: join(import.meta.url, 'help'),
  // the default
  ext: '.txt'
})

const program = commist({ maxDistance: 2 })

program.register('help', help.toStdout)
program.register('help compile', help.toStdout.bind(null, ['compile']))
program.register('compile', compile)

export async function run (argv) {
  const args = parseArgs(argv, {
    alias: {
      v: 'version'
    }
  })

  if (args.version) {
    console.log('v' + JSON.parse(await readFile(join(import.meta.url, '../package.json'), 'utf-8')).version)
    process.exit(0)
  }

  /* c8 ignore next 4 */
  return {
    output: await program.parseAsync(argv),
    help
  }
}

if (isMain(import.meta)) {
  try {
    await run(process.argv.slice(2))
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}
