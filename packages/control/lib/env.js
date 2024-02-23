'use strict'

const { parseArgs } = require('node:util')
const RuntimeApiClient = require('./runtime-api-client')

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
  const runtime = await client.getMatchingRuntime(args)

  const runtimeEnv = await client.getRuntimeEnv(runtime.pid)
  let output = ''
  for (const key in runtimeEnv) {
    output += `${key}=${runtimeEnv[key]}\n`
  }
  console.log(output)

  await client.close()
}

module.exports = getRuntimeEnvCommand
