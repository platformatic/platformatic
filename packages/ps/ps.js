#! /usr/bin/env node

const { join } = require('node:path')
const { parseArgs } = require('node:util')
const commist = require('commist')

const listRuntimesCommand = require('./lib/list')
const stopRuntimeServiceCommand = require('./lib/stop')
const closeRuntimeServiceCommand = require('./lib/close')
const startRuntimeServiceCommand = require('./lib/start')
const restartRuntimeServiceCommand = require('./lib/restart')
const streamRuntimeLogsCommand = require('./lib/logs')

const program = commist({ maxDistance: 2 })

program.register('stop', stopRuntimeServiceCommand)
program.register('start', startRuntimeServiceCommand)
program.register('close', closeRuntimeServiceCommand)
program.register('restart', restartRuntimeServiceCommand)
program.register('logs', streamRuntimeLogsCommand)

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

module.exports = { runPS }
