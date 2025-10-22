import { resolve, validationOptions } from '@platformatic/basic'
import {
  abstractLogger,
  ensureLoggableError,
  extractModuleFromSchemaUrl,
  findRuntimeConfigurationFile,
  kMetadata,
  loadConfigurationModule,
  loadConfiguration as utilsLoadConfiguration
} from '@platformatic/foundation'
import closeWithGrace from 'close-with-grace'
import inspector from 'node:inspector'
import { transform, wrapInRuntimeConfig } from './lib/config.js'
import { NodeInspectorFlagsNotSupportedError } from './lib/errors.js'
import { Runtime } from './lib/runtime.js'
import { schema } from './lib/schema.js'
import { upgrade } from './lib/upgrade.js'

async function restartRuntime (runtime) {
  runtime.logger.info('Received SIGUSR2, restarting all applications ...')

  try {
    await runtime.restart()
  } catch (err) {
    runtime.logger.error({ err: ensureLoggableError(err) }, 'Failed to restart applications.')
  }
}

function handleSignal (runtime, config) {
  // The very first time we add a listener for SIGUSR2,
  // ignore it since it comes from close-with-grace and we want to use to restart the runtime
  function filterCloseWithGraceSIGUSR2 (event, listener) {
    if (event === 'SIGUSR2') {
      process.removeListener('SIGUSR2', listener)
      process.removeListener('newListener', filterCloseWithGraceSIGUSR2)
    }
  }

  function onTimeout (timeout) {
    runtime.logger.error(`Could not close the runtime in ${timeout} ms, aborting the process with exit code 1.`)
  }

  process.on('newListener', filterCloseWithGraceSIGUSR2)

  const cwg = closeWithGrace({ delay: config.gracefulShutdown?.runtime ?? 10000, onTimeout }, async event => {
    if (event.err instanceof Error) {
      console.error(new Error('@platformatic/runtime threw an unexpected error', { cause: event.err }))
    }
    await runtime.close()
  })

  /* c8 ignore next 3 */
  const restartListener = restartRuntime.bind(null, runtime)
  process.on('SIGUSR2', restartListener)

  runtime.on('closed', () => {
    process.removeListener('SIGUSR2', restartListener)
    cwg.uninstall()
  })
}

export async function loadConfiguration (configOrRoot, sourceOrConfig, context) {
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

export async function loadApplicationsCommands () {
  const applications = {}
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
    return { applications, commands, help }
  }

  for (const application of config.applications) {
    try {
      const applicationConfig = await utilsLoadConfiguration(application.config)
      const pkg = await loadConfigurationModule(application.path, applicationConfig)

      if (pkg.createCommands) {
        const definition = await pkg.createCommands(application.id)
        for (const command of Object.keys(definition.commands)) {
          applications[command] = application
        }

        Object.assign(commands, definition.commands)
        Object.assign(help, definition.help)
      }
      /* c8 ignore next 3 - Hard to test */
    } catch {
      // No-op, ignore the application
    }
  }

  return { applications, commands, help }
}

export async function create (configOrRoot, sourceOrConfig, context) {
  const config = await loadConfiguration(configOrRoot, sourceOrConfig, context)

  if (inspector.url() && !config[kMetadata].env.VSCODE_INSPECTOR_OPTIONS) {
    throw new NodeInspectorFlagsNotSupportedError()
  }

  let runtime = new Runtime(config, context)
  handleSignal(runtime, config)

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

        await runtime.close()

        // Get the actual port from the error message if original port was 0
        if (!port) {
          const mo = err.message.match(/ address already in use (.+)/)
          const url = new URL(`http://${mo[1]}`)
          port = Number(url.port)
        }

        config.server.port = ++port
        runtime = new Runtime(config, context)
        handleSignal(runtime, config)
      }
    }
  }

  return runtime
}

export { prepareApplication, transform, wrapInRuntimeConfig } from './lib/config.js'
export * as errors from './lib/errors.js'
export { RuntimeGenerator as Generator, WrappedGenerator } from './lib/generator.js'
export { Runtime } from './lib/runtime.js'
export { schema } from './lib/schema.js'
export * from './lib/version.js'
export * as symbols from './lib/worker/symbols.js'
