'use strict'

const { parseArgs } = require('node:util')
const RuntimeApiClient = require('./runtime-api-client')
const errors = require('./errors')

async function getRuntimeEnvCommand (argv) {
  const args = parseArgs({
    args: argv,
    options: {
      pid: { type: 'string', short: 'p' },
      name: { type: 'string', short: 'n' }
    },
    strict: false
  }).values

  const client = new RuntimeApiClient()

  let runtime = null
  if (args.pid) {
    runtime = await client.getRuntimeByPID(parseInt(args.pid))
  } else if (args.name) {
    runtime = await client.getRuntimeByPackageName(args.name)
  } else {
    throw errors.MissingRuntimeIdentifier()
  }

  if (!runtime) {
    throw errors.RuntimeNotFound()
  }

  const runtimeEnv = await client.getRuntimeEnv(runtime.pid)
  let output = ''
  for (const key in runtimeEnv) {
    output += `${key}=${runtimeEnv[key]}\n`
  }
  console.log(output)

  await client.close()
}

module.exports = getRuntimeEnvCommand
