'use strict'

const { parseArgs } = require('node:util')
const { writeFile } = require('node:fs/promises')
const RuntimeApiClient = require('./runtime-api-client')
const errors = require('./errors')

async function injectRuntimeCommand (argv) {
  const { values: args, positionals } = parseArgs({
    args: argv,
    options: {
      pid: { type: 'string', short: 'p' },
      name: { type: 'string', short: 'n' },
      service: { type: 'string', short: 's' },
      request: { type: 'string', short: 'X', default: 'GET' },
      header: { type: 'string', short: 'H', multiple: true },
      data: { type: 'string', short: 'd' },
      include: { type: 'boolean', short: 'i', default: false },
      output: { type: 'string', short: 'o' }
    },
    strict: false
  })

  const client = new RuntimeApiClient()
  const runtime = await client.getMatchingRuntime(args)

  let serviceId = args.service
  if (!serviceId) {
    const runtimeServices = await client.getRuntimeServices(runtime.pid)
    serviceId = runtimeServices.entrypoint
  }

  if (positionals.length === 0) {
    throw errors.MissingRequestURL()
  }

  const fullUrl = new URL(positionals[0], runtime.url)
  const injectPath = fullUrl.href.slice(runtime.url.length)

  const method = args.request
  const body = args.data

  const headers = {}
  for (const header of args.header || []) {
    const [name, value] = header.split(':')
    headers[name] = value
  }

  const injectOptions = { url: injectPath, method, headers, body }

  const response = await client.injectRuntime(runtime.pid, serviceId, injectOptions)

  let result = ''
  if (args.include) {
    result += `HTTP/1.1 ${response.statusCode}\n`
    for (const header in response.headers) {
      result += `${header}: ${response.headers[header]}\n`
    }
    result += '\n'
  }
  result += await response.body.text()

  if (args.output) {
    await writeFile(args.output, result)
  } else {
    console.log(result)
  }

  await client.close()
}

module.exports = injectRuntimeCommand
