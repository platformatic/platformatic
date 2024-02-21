#! /usr/bin/env node

const { join } = require('node:path')
const { parseArgs } = require('node:util')
const commist = require('commist')

const getRuntimesEnvCommand = require('./lib/env')
const getRuntimeServicesCommand = require('./lib/services')
const listRuntimesCommand = require('./lib/list')
const stopRuntimeServiceCommand = require('./lib/stop')
const closeRuntimeServiceCommand = require('./lib/close')
const startRuntimeServiceCommand = require('./lib/start')
const restartRuntimeServiceCommand = require('./lib/restart')
const injectRuntimeCommand = require('./lib/inject')
const streamRuntimeLogsCommand = require('./lib/logs')

const program = commist({ maxDistance: 2 })

program.register('stop', wrapCommand(stopRuntimeServiceCommand))
program.register('start', wrapCommand(startRuntimeServiceCommand))
program.register('close', wrapCommand(closeRuntimeServiceCommand))
program.register('restart', wrapCommand(restartRuntimeServiceCommand))
program.register('logs', wrapCommand(streamRuntimeLogsCommand))
program.register('env', wrapCommand(getRuntimesEnvCommand))
program.register('services', wrapCommand(getRuntimeServicesCommand))
program.register('inject', wrapCommand(injectRuntimeCommand))

async function runPS (argv) {
  if (argv.length === 0) {
    listRuntimesCommand()
    return {}
  }

  const args = parseArgs({
    args: argv,
    options: {
      version: { type: 'boolean', short: 'v' }
    },
    strict: false
  }).values

  if (args.version) {
    const packageJson = require(join(__dirname, 'package.json'))
    console.log(packageJson.version)
    process.exit(0)
  }

  const output = await program.parseAsync(argv)
  return { output }
}

if (require.main === module) {
  runPS(process.argv.slice(2))
}

function wrapCommand (fn) {
  return async function (...args) {
    try {
      return await fn(...args)
    } catch (err) {
      console.log(err.message)
    }
  }
}

module.exports = { runPS }
