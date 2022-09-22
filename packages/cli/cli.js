#! /usr/bin/env node

import commist from 'commist'
import minimist from 'minimist'
import { runDB } from '@platformatic/db/db.mjs'
import { login } from '@platformatic/authenticate/authenticate.js'
import { readFile } from 'fs/promises'
import { join } from 'desm'
import { isColorSupported } from 'colorette'
import helpMe from 'help-me'

import { logo } from './lib/ascii.js'

const program = commist()
const help = helpMe({
  dir: join(import.meta.url, 'help'),
  // the default
  ext: '.txt'
})

program.register('db', runDB)
program.register('help', help.toStdout)
program.register('help db', function (args) {
  runDB(['help', ...args])
})
program.register({ command: 'login', strict: true }, login)

/* c8 ignore next 3 */
if (isColorSupported && process.stdout.isTTY) {
  console.log(logo)
}

const args = minimist(process.argv.slice(2), {
  boolean: ['help', 'version'],
  alias: {
    help: 'h',
    version: 'v'
  }
})

if (args.version) {
  const version = JSON.parse(await readFile(join(import.meta.url, 'package.json'))).version
  console.log('v' + version)
  process.exit(0)
}

if (args.help) {
  help.toStdout(['help'])
} else if (process.argv.length > 2) {
  const result = program.parse(process.argv.slice(2))

  if (result) {
    console.log('Command not found:', result.join(' '))
  }
} else {
  help.toStdout(['help'])
}
