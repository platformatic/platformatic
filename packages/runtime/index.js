'use strict'

const inspector = require('node:inspector')
const {
  kMetadata,
  loadConfigurationModule,
  abstractLogger,
  findRuntimeConfigurationFile,
  loadConfiguration: utilsLoadConfiguration,
  extractModuleFromSchemaUrl,
  ensureLoggableError
} = require('@platformatic/foundation')
const { resolve, validationOptions } = require('@platformatic/basic')
const { NodeInspectorFlagsNotSupportedError } = require('./lib/errors')
const { wrapInRuntimeConfig, transform } = require('./lib/config')
const { RuntimeGenerator, WrappedGenerator } = require('./lib/generator')
const { Runtime } = require('./lib/runtime')
const symbols = require('./lib/worker/symbols')
const { schema } = require('./lib/schema')
const { upgrade } = require('./lib/upgrade')
const { getRuntimeLogsDir } = require('./lib/utils')

async function restartRuntime (runtime) {
  runtime.logger.info('Received SIGUSR2, restarting all services ...')

  try {
    await runtime.restart()
  } catch (err) {
    runtime.logger.error({ err: ensureLoggableError(err) }, 'Failed to restart services.')
  }
}

function handleSignal (runtime) {
  /* c8 ignore next 3 */
  const restartListener = restartRuntime.bind(null, runtime)
  process.on('SIGUSR2', restartListener)
  runtime.on('closed', () => {
    process.removeListener('SIGUSR2', restartListener)
  })
}

async function loadConfiguration (configOrRoot, sourceOrConfig, context) {
  const { root, source } = await resolve(configOrRoot, sourceOrConfig, 'runtime')

  // First of all, load the configuration without any validation
  const config = await utilsLoadConfiguration(source)
  const mod = extractModuleFromSchemaUrl(config)
  if (mod?.module !== '@platformatic/runtime') {
    return wrapInRuntimeConfig(config, context)
  }

  return utilsLoadConfiguration(source, context?.schema ?? schema, {
    validationOptions,
    transform,
    upgrade,
    replaceEnv: true,
    root,
    ...context
  })
}

async function loadServicesCommands () {
  const services = {}
  const commands = {}
  const help = {}

  let config
  try {
    const file = await findRuntimeConfigurationFile(abstractLogger, process.cwd(), null, false, false)

    /* c8 ignore next 3 - Hard to test */
    if (!file) {
      throw new Error('No runtime configuration file found.')
    }

    config = await loadConfiguration(file)

    /* c8 ignore next 3 - Hard to test */
    if (!config) {
      throw new Error('No runtime configuration file found.')
    }
  } catch {
    return { services, commands, help }
  }

  for (const service of config.services) {
    try {
      const serviceConfig = await utilsLoadConfiguration(service.config)
      const pkg = await loadConfigurationModule(service.path, serviceConfig)

      if (pkg.createCommands) {
        const definition = await pkg.createCommands(service.id)
        for (const command of Object.keys(definition.commands)) {
          services[command] = service
        }

        Object.assign(commands, definition.commands)
        Object.assign(help, definition.help)
      }
      /* c8 ignore next 3 - Hard to test */
    } catch {
      // No-op, ignore the service
    }
  }

  return { services, commands, help }
}

async function create (configOrRoot, sourceOrConfig, context) {
  const config = await loadConfiguration(configOrRoot, sourceOrConfig, context)

  if (inspector.url() && !config[kMetadata].env.VSCODE_INSPECTOR_OPTIONS) {
    throw new NodeInspectorFlagsNotSupportedError()
  }

  let runtime = new Runtime(config, context)
  handleSignal(runtime)

  // Handle port handling
  if (context?.start) {
    let port = config.server?.port

    while (true) {
      try {
        await runtime.start()
        break
      } catch (err) {
        if ((err.code !== 'EADDRINUSE' && err.code !== 'EACCES') || context?.skipPortInUseHandling) {
          throw err
        }

        // Get the actual port from the error message if original port was 0
        if (!port) {
          const mo = err.message.match(/ address already in use (.+)/)
          const url = new URL(`http://${mo[1]}`)
          port = Number(url.port)
        }

        config.server.port = ++port
        runtime = new Runtime(config, context)
        handleSignal(runtime)
      }
    }
  }

  return runtime
}

const platformaticVersion = require('./package.json').version

module.exports.errors = require('./lib/errors')
module.exports.Generator = RuntimeGenerator
module.exports.WrappedGenerator = WrappedGenerator
module.exports.getRuntimeLogsDir = getRuntimeLogsDir
module.exports.schema = schema
module.exports.symbols = symbols
module.exports.Runtime = Runtime
module.exports.wrapInRuntimeConfig = wrapInRuntimeConfig
module.exports.version = platformaticVersion
module.exports.loadConfiguration = loadConfiguration
module.exports.create = create
module.exports.transform = transform
module.exports.loadServicesCommands = loadServicesCommands
