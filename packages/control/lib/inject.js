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
      verbose: { type: 'boolean', short: 'v', default: false },
      output: { type: 'string', short: 'o' },
    },
    strict: false,
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

  let result = ''

  const fullUrl = new URL(positionals[0], runtime.url)
  const injectPath = fullUrl.href.slice(runtime.url.length)

  const method = args.request
  const body = args.data

  if (args.verbose) {
    result += `> ${method} ${injectPath} HTTP/1.1\n`
  }

  const headers = {}
  for (const header of args.header || []) {
    const [name, value] = header.split(':')
    headers[name] = value

    if (args.verbose) {
      result += `> ${name}: ${value}\n`
    }
  }

  if (args.verbose && args.header.length > 0) {
    result += '> \n'
  }

  const injectOptions = { url: injectPath, method, headers, body }

  const response = await client.injectRuntime(runtime.pid, serviceId, injectOptions)

  if (args.verbose) {
    result += `< HTTP/1.1 ${response.statusCode}\n`
  }
  if (args.include) {
    result += `HTTP/1.1 ${response.statusCode}\n`
  }

  for (const header in response.headers) {
    if (args.verbose) {
      result += `< ${header}: ${response.headers[header]}\n`
    }
    if (args.include) {
      result += `${header}: ${response.headers[header]}\n`
    }
  }

  if (args.verbose) {
    result += '< \n'
  }
  if (args.include) {
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
