#! /usr/bin/env node
import { command as client } from '@platformatic/client-cli'
import {
  getRuntimesCommand,
  injectRuntimeCommand,
  runControl,
  streamRuntimeLogsCommand
} from '@platformatic/control/control.js'
import { startCommand } from '@platformatic/runtime'
import { compile, run as runRuntime } from '@platformatic/runtime/bin/plt-runtime.mjs'
import { checkNodeVersionForServices } from '@platformatic/utils'
import { isColorSupported } from 'colorette'
import commist from 'commist'
import { join } from 'desm'
import helpMe from 'help-me'
import minimist from 'minimist'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { logo } from './lib/ascii.js'
import { build } from './lib/build.js'
import { install } from './lib/install.js'
import { patchConfig } from './lib/patch-config.js'
import { resolve } from './lib/resolve.js'

checkNodeVersionForServices()

const program = commist({ maxDistance: 2 })
const help = helpMe({
  dir: join(import.meta.url, 'help'),
  // the default
  ext: '.txt'
})

async function load (moduleName) {
  const require = createRequire(path.join(process.cwd(), 'package.json'))
  const file = require.resolve(moduleName)
  return import(pathToFileURL(file))
}

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

program.register('db', async args => {
  const { runDB } = await load('@platformatic/db/bin/plt-db.mjs')
  return ensureCommand(await runDB(args))
})
program.register('runtime', async args => ensureCommand(await runRuntime(args)))
program.register('service', async args => {
  const { runService } = await load('@platformatic/service/bin/plt-service.mjs')
  return ensureCommand(await runService(args))
})
program.register('composer', async args => {
  const { runComposer } = await load('@platformatic/composer/bin/plt-composer.mjs')
  return ensureCommand(await runComposer(args))
})
program.register('start', async args => ensureCommand(await startCommand(args)))
program.register('ctl', async args => ensureCommand(await runControl(args)))
program.register('ps', async args => getRuntimesCommand(args))
program.register('inject', async args => injectRuntimeCommand(args))
program.register('logs', async args => streamRuntimeLogsCommand(args))
program.register('resolve', resolve)
program.register('patch-config', patchConfig)
program.register('client', client)
program.register('build', build)
program.register('install', install)
program.register('compile', async args => ((await compile(args)) ? null : process.exit(1)))
program.register('help', help.toStdout)
program.register('help db', async args => {
  const { runDB } = await load('@platformatic/db/bin/plt-db.mjs')
  return runDB(['help', ...args])
})
program.register('help client', () => client([]))
program.register('help runtime', async args => runRuntime(['help', ...args]))
program.register('help service', async args => {
  const { runService } = await load('@platformatic/service/bin/plt-service.mjs')
  return runService(['help', ...args])
})

const args = minimist(process.argv.slice(2), {
  boolean: ['help', 'version'],
  alias: {
    help: 'h',
    version: 'v'
  }
})

if (args.version && !args._.includes('inject')) {
  const version = JSON.parse(await readFile(join(import.meta.url, 'package.json'), 'utf-8')).version
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
