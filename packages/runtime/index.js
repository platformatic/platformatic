import { importCapabilityPackage, resolve, validationOptions } from '@platformatic/basic'
import {
  abstractLogger,
  ensureLoggableError,
  extractModuleFromSchemaUrl,
  findRuntimeConfigurationFile,
  kMetadata,
  loadConfigurationModule,
  loadConfiguration as utilsLoadConfiguration
} from '@platformatic/foundation'
import {
  isConfigurationFileName,
  findDecidingFile,
  loadConfiguration as loadV4Configuration,
  validateCapabilityConfiguration
} from '@platformatic/foundation/lib/v4/index.js'
import closeWithGrace from 'close-with-grace'
import { stat } from 'node:fs/promises'
import inspector from 'node:inspector'
import { basename, dirname, resolve as resolvePath } from 'node:path'
import { transform as v3Transform, transformV4, wrapInRuntimeConfig } from './lib/config.js'
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

/*
  v4 configuration is code, evaluated by the loader in foundation: it walks to the deciding file,
  resolves both views of the env ladder, evaluates the root in a worker and fans out one worker per
  per-app file. Everything the runtime transform used to discover — the application list, each
  application's capability, its schema and its worker environment — arrives already resolved.

  Routing by filename keeps the v3 path intact while the in-tree JSON fixtures are converted; the
  v3 half is what a later commit deletes, not something this one has to keep working around.
*/
/*
  A configuration named outright does not have to carry one of the four discoverable names -- that
  is what discovery is for, and --config exists precisely to point at something discovery would not
  find. What decides the dialect is the extension: v4 configuration is code, and v3 configuration is
  a document.
*/
function isV4ConfigurationPath (path) {
  return isConfigurationFileName(basename(path)) || /\.(js|mjs|ts|mts)$/.test(path)
}

async function findV4ConfigurationFile (configOrRoot, sourceOrConfig) {
  // A programmatic object source is not this path: the v4 object entry point is
  // loadObjectConfiguration, which skips the root eval worker entirely.
  if (sourceOrConfig && typeof sourceOrConfig !== 'string') {
    return null
  }

  if (typeof sourceOrConfig === 'string') {
    const named = resolvePath(configOrRoot, sourceOrConfig)

    return isV4ConfigurationPath(named) ? named : null
  }

  if (typeof configOrRoot !== 'string') {
    return null
  }

  if (isV4ConfigurationPath(configOrRoot)) {
    return configOrRoot
  }

  /*
    Only an actual directory is a place to search from. findDecidingFile walks toward the env root,
    so handing it a path that does not exist would answer with whatever project sits above it: a
    typo'd --config would boot the parent rather than failing. v3 looks in the named directory and
    nowhere else, and a wrong path has to stay an error.
  */
  const stats = await stat(configOrRoot).catch(() => null)

  if (!stats?.isDirectory()) {
    return null
  }

  try {
    const deciding = await findDecidingFile(configOrRoot, { throwOnMissing: false })

    return deciding?.path ?? null
  } catch (error) {
    /*
      The walk refuses a v3 configuration wherever it consults, which is right once v3 is gone and
      wrong while it is still supported: here a v3 file means "this project is not v4", and the v3
      loader below is the one that should answer. Deleting this catch is part of deleting the v3
      path, and at that point the refusal becomes the correct answer again.
    */
    if (error.code === 'PLT_LEGACY_CONFIGURATION_FILE') {
      return null
    }

    throw error
  }
}

export async function loadConfiguration (configOrRoot, sourceOrConfig, context) {
  // Checked before the v3 resolver, which throws when it finds no v3 file — a v4-only project has
  // none by construction.
  const v4ConfigurationFile = await findV4ConfigurationFile(configOrRoot, sourceOrConfig)

  if (v4ConfigurationFile) {
    return loadV4RuntimeConfiguration(v4ConfigurationFile, context)
  }

  const { root, source } = await resolve(configOrRoot, sourceOrConfig, 'runtime')

  // First of all, load the configuration without any validation
  const config = await utilsLoadConfiguration(source, null, {
    root,
    envFile: context?.envFile
  })

  if (config.envfile) {
    // The context is optional, so it might not have been provided at all
    context ??= {}
    context.envFile = config.envfile
  }

  const mod = extractModuleFromSchemaUrl(config)
  if (mod?.module !== '@platformatic/runtime') {
    return wrapInRuntimeConfig(config, context)
  }

  return utilsLoadConfiguration(source, context?.schema ?? schema, {
    validationOptions,
    transform: v3Transform,
    upgrade,
    replaceEnv: true,
    root,
    ...context
  })
}

async function loadV4RuntimeConfiguration (configurationFile, context) {
  const production = context?.isProduction ?? context?.production ?? false

  /*
    The environment the loader treats as real. An embedder can add to it, and can ask for a
    hermetic runtime that sees none of this process's -- v3 honours both through loadEnv, and a v4
    runtime that ignored them would quietly hand every worker the parent's environment.
  */
  const realEnv = context?.ignoreProcessEnv ? { ...context?.env } : { ...process.env, ...context?.env }

  const loaded = await loadV4Configuration({
    cwd: dirname(configurationFile),
    configPath: configurationFile,
    realEnv,
    command: context?.command ?? (production ? 'start' : 'dev'),
    mode: context?.mode,
    production,
    customEnvFile: context?.envFile,
    /*
      Validation imports each capability's schema, so it needs the capability installed — not
      merely declared, which is all the detector needs. That moves the moment a capability must be
      resolvable earlier than v3 ever needed it: v3 loaded fine and failed later, in the worker.

      A caller that is loading only to discover the topology — a tool about to install those
      dependencies, for instance — can say so rather than being made to install first.
    */
    validateCapabilities: context?.validateCapabilities ?? true,
    // The runtime is where the bundled capability copies live, so it is the fallback scope for
    // both the schema import and the version stamp — the application's own dependencies still
    // come first.
    runtimeScope: import.meta.filename,
    onWarning: warning => abstractLogger.warn(warning.message),
    onInfo: info => abstractLogger.info(info.message)
  })

  const config = loaded.config

  /*
    The documented pipeline is validation with useDefaults, then kMetadata, then transform. The eval
    worker's own check is a shape check that injects nothing — deliberately, so the resolve
    projection carries authored values — so this is where the runtime schema's defaults arrive, and
    without it the runtime reaches for settings like gracefulShutdown that nothing supplied.
  */
  validateCapabilityConfiguration(config, context?.schema ?? schema, {
    id: 'runtime',
    module: '@platformatic/runtime',
    root: loaded.root
  })

  // kMetadata is symbol-keyed and cannot cross a worker boundary, so each worker rebuilds it; this
  // is the main process's copy. env is the runtime's own view — every application worker gets the
  // per-application environment the loader resolved, not this one.
  config[kMetadata] = {
    root: loaded.root,
    path: loaded.configPath,
    env: process.env,
    module: '@platformatic/runtime',
    /*
      The evaluation context, kept beside the envelope rather than inside it: applications added
      after boot are evaluated with the same command, mode and production flags the boot pass used,
      and its presence is also what tells the add path this runtime is v4 at all. A v3 runtime has
      no such context and keeps resolving configuration files worker-side.
    */
    v4: {
      command: context?.command ?? (production ? 'start' : 'dev'),
      mode: loaded.mode,
      production: loaded.production
    }
  }

  /*
    A caller-supplied transform replaces the built-in one, exactly as it does on the v3 path where
    it arrives as part of ...context. Ignoring it here meant a test helper or an embedder that
    customized the configuration was silently not consulted.
  */
  const apply = context?.transform ?? transformV4

  return apply(config, null, context)
}

export async function loadApplicationsCommands (executableName = '', configurationFile = null) {
  const applications = {}
  const commands = {}
  const help = {}

  let config
  try {
    const file = await findRuntimeConfigurationFile(
      abstractLogger,
      process.cwd(),
      configurationFile,
      false,
      false,
      true,
      executableName
    )

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
      /*
        A v4 application arrives with its configuration already evaluated and its capability
        already named, so there is nothing to read and nothing to infer. Reading application.config
        as a path threw into the catch below, which skipped the application silently -- the command
        it contributes then simply did not exist, and the CLI said the command was unknown.
      */
      const applicationConfig = application.resolvedConfig ?? (await utilsLoadConfiguration(application.config))
      const pkg = application.module
        ? await importCapabilityPackage(application.path, application.module)
        : await loadConfigurationModule(application.path, applicationConfig)

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
  const setupSignals = context?.setupSignals ?? true
  const config = await loadConfiguration(configOrRoot, sourceOrConfig, context)

  if (inspector.url() && !config[kMetadata].env.VSCODE_INSPECTOR_OPTIONS) {
    throw new NodeInspectorFlagsNotSupportedError()
  }

  const runtime = new Runtime(config, context)
  if (setupSignals) {
    handleSignal(runtime, config)
  }

  // Handle startup
  if (context?.start) {
    try {
      await runtime.init()
      if (context.reloaded) {
        runtime.logger.info('The application has been successfully reloaded.')
      }

      await runtime.start()
    } catch (err) {
      await runtime.close()
      throw err
    }
  }

  return runtime
}

export { prepareApplication, wrapInRuntimeConfig } from './lib/config.js'

/*
  The exported transform dispatches on the dialect. Callers wrap it -- they call it and then adjust
  the result -- and a wrapper that reached the v3 transform with a v4 configuration would run the
  wrong pipeline over it: autoload expansion and enabled filtering have already happened in the
  eval worker. v4 configurations are recognizable by the evaluation context on kMetadata.
*/
export async function transform (config, schema, context) {
  return config?.[kMetadata]?.v4 ? transformV4(config, schema, context) : v3Transform(config, schema, context)
}
export * as errors from './lib/errors.js'
export { RuntimeGenerator as Generator, WrappedGenerator } from './lib/generator.js'
export { setupLoopbackMessaging } from './lib/loopback-messaging.js'
export { Runtime } from './lib/runtime.js'
export { schema } from './lib/schema.js'
export * from './lib/version.js'
export * as symbols from './lib/worker/symbols.js'
