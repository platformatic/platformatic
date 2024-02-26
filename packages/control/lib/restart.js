'use strict'

const { parseArgs } = require('node:util')
const RuntimeApiClient = require('./runtime-api-client')
const errors = require('./errors')

async function restartRuntimeCommand (argv) {
  const args = parseArgs({
    args: argv,
    options: {
      pid: { type: 'string', short: 'p' },
      name: { type: 'string', short: 'n' }
    },
    strict: false
  }).values

  const client = new RuntimeApiClient()
  const runtime = await client.getMatchingRuntime(args)

  if (!runtime) {
    throw errors.RuntimeNotFound()
  }

  const runtimeProcess = await client.restartRuntime(runtime.pid, { stdio: 'inherit' })

  process.on('SIGINT', () => {
    runtimeProcess.kill('SIGINT')
  })

  process.on('SIGTERM', () => {
    runtimeProcess.kill('SIGTERM')
  })

  await client.close()
}

module.exports = restartRuntimeCommand
