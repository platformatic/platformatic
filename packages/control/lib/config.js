'use strict'

const { parseArgs } = require('node:util')
const RuntimeApiClient = require('./runtime-api-client')

async function getRuntimeConfigCommand (argv) {
  const args = parseArgs({
    args: argv,
    options: {
      pid: { type: 'string', short: 'p' },
      name: { type: 'string', short: 'n' },
      service: { type: 'string', short: 's' }
    },
    strict: false
  }).values

  const client = new RuntimeApiClient()
  const runtime = await client.getMatchingRuntime(args)

  const config = args.service
    ? await client.getRuntimeServiceConfig(runtime.pid, args.service)
    : await client.getRuntimeConfig(runtime.pid)

  console.log(JSON.stringify(config, null, 2))

  await client.close()
}

module.exports = getRuntimeConfigCommand
