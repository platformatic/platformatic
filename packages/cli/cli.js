#! /usr/bin/env node

import commist from 'commist'
import minimist from 'minimist'
import { runDB } from '@platformatic/db/db.mjs'
import { run as runRuntime, compile } from '@platformatic/runtime/runtime.mjs'
import { startCommand } from '@platformatic/runtime'
import { runService } from '@platformatic/service/service.mjs'
import { runComposer } from '@platformatic/composer/composer.mjs'
import { login } from '@platformatic/authenticate/authenticate.js'
import { command as client } from '@platformatic/client-cli'
import { readFile } from 'fs/promises'
import { join } from 'desm'
import { isColorSupported } from 'colorette'
import helpMe from 'help-me'
import { upgrade } from './lib/upgrade.js'
import { gh } from './lib/gh.js'
import { deploy } from './lib/deploy.js'
import { logo } from './lib/ascii.js'
import {
  runControl,
  getRuntimesCommand,
  injectRuntimeCommand,
  streamRuntimeLogsCommand
} from '@platformatic/control/control.js'

const program = commist({ maxDistance: 2 })
const help = helpMe({
  dir: join(import.meta.url, 'help'),
  // the default
  ext: '.txt'
})

const ensureCommand = async ({ output, help }) => {
  if (!output) {
    return
  }

  if (output.length) {
    console.log('Command not found:', output.join(' '), '\n')
  }

  await help.toStdout()
  process.exit(1)
}

program.register('db', async (args) => ensureCommand(await runDB(args)))
program.register('runtime', async (args) => ensureCommand(await runRuntime(args)))
program.register('service', async (args) => ensureCommand(await runService(args)))
program.register('composer', async (args) => ensureCommand(await runComposer(args)))
program.register('start', async (args) => ensureCommand(await startCommand(args)))
program.register('ctl', async (args) => ensureCommand(await runControl(args)))
program.register('ps', async (args) => getRuntimesCommand(args))
program.register('inject', async (args) => injectRuntimeCommand(args))
program.register('logs', async (args) => streamRuntimeLogsCommand(args))
program.register('upgrade', upgrade)
program.register('client', client)
program.register('compile', async (args) => await compile(args) ? null : process.exit(1))
program.register('help', help.toStdout)
program.register('help db', async (args) => runDB(['help', ...args]))
program.register('help client', () => client([]))
program.register('help runtime', async (args) => runRuntime(['help', ...args]))
program.register('help service', async (args) => runService(['help', ...args]))
program.register({ command: 'login', strict: true }, login)
program.register('gh', gh)
program.register('deploy', deploy)

const args = minimist(process.argv.slice(2), {
  boolean: ['help', 'version'],
  alias: {
    help: 'h',
    version: 'v'
  }
})

if (args.version && !args._.includes('versions') && !args._.includes('inject')) {
  const version = JSON.parse(await readFile(join(import.meta.url, 'package.json'))).version
  console.log('v' + version)
  process.exit(0)
}

if (args.help) {
  await help.toStdout(['help'])
} else if (process.argv.length > 2) {
  const output = await program.parseAsync(process.argv.slice(2))
  await ensureCommand({ output, help })
/* c8 ignore start */
} else {
  if (isColorSupported && process.stdout.isTTY) {
    console.log(logo)
  }
  await help.toStdout(['help'])
}
/* c8 ignore stop */
