'use strict'

const { parseArgs } = require('node:util')
const errors = require('./errors')
const {
  getRuntimeByPID,
  getRuntimeByPackageName,
  getRuntimeEnv
} = require('./runtime-api')

async function getRuntimeEnvCommand (argv) {
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

  const runtimeEnv = await getRuntimeEnv(runtime.pid)
  let output = ''
  for (const key in runtimeEnv) {
    output += `${key}=${runtimeEnv[key]}\n`
  }
  console.log(output)
}

module.exports = getRuntimeEnvCommand
