'use strict'

const { parseArgs } = require('node:util')
const { writeFile } = require('node:fs/promises')
const errors = require('./errors')
const {
  getRuntimeByPID,
  getRuntimeByPackageName,
  getRuntimeServices,
  injectRuntime
} = require('./runtime-api')

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

  let runtime = null
  if (args.pid) {
    runtime = await getRuntimeByPID(parseInt(args.pid))
  } else if (args.name) {
    runtime = await getRuntimeByPackageName(args.name)
  } else {
    throw errors.MissingRuntimeIdentifier()
  }

  if (!runtime) {
    throw errors.RuntimeNotFound()
  }

  let serviceId = args.service
  if (!serviceId) {
    const runtimeServices = await getRuntimeServices(runtime.pid)
    serviceId = runtimeServices.entrypoint
  }

  if (positionals.length === 0) {
    throw errors.MissingRequestURL()
  }

  const url = positionals[0]
  const method = args.request
  const body = args.data

  const headers = {}
  for (const header of args.header || []) {
    const [name, value] = header.split(':')
    headers[name] = value
  }

  const injectOptions = { url, method, headers, body }

  const response = await injectRuntime(runtime.pid, serviceId, injectOptions)

  let result = ''
  if (args.include) {
    result += `HTTP/1.1 ${response.statusCode}\n`
    for (const header in response.headers) {
      result += `${header}: ${response.headers[header]}\n`
    }
    result += '\n'
  }
  result += response.body

  if (args.output) {
    await writeFile(args.output, result)
    return
  }

  console.log(result)
}

module.exports = injectRuntimeCommand
