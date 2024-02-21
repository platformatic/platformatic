'use strict'

const { parseArgs } = require('node:util')
const errors = require('./errors')
const {
  getRuntimeByPID,
  getRuntimeByPackageName,
  getRuntimeServices
} = require('./runtime-api')

function buildRuntimeTopology (runtimeTopology) {
  const entrypoint = runtimeTopology.services.find(service => service.entrypoint)

  let topology = `- ${entrypoint.id} (${entrypoint.type}) <- entrypoint`
  for (const service of runtimeTopology.services) {
    if (service.entrypoint) continue
    topology += `\n - ${service.id} (${service.type})`
  }

  return topology
}

async function getRuntimeServicesCommand (argv) {
  const args = parseArgs({
    args: argv,
    options: {
      pid: { type: 'string', short: 'p' },
      name: { type: 'string', short: 'n' }
    },
    strict: false
  }).values

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

  const runtimeServices = await getRuntimeServices(runtime.pid)
  console.log(buildRuntimeTopology(runtimeServices))
}

module.exports = getRuntimeServicesCommand
