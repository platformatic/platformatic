import { importCapabilityPackage, resolve } from '@platformatic/basic'
import {
  abstractLogger,
  ensureLoggableError,
  findRuntimeConfigurationFile,
  kMetadata,
  loadConfigurationModule
} from '@platformatic/foundation'
import {
  findDecidingFile,
  isProductionCommand,
  LegacyConfigurationFileError,
  loadConfiguration as loadV4Configuration,
  loadObjectConfiguration as loadV4ObjectConfiguration,
  validateCapabilityConfiguration
} from '@platformatic/foundation/lib/v4/index.js'
import closeWithGrace from 'close-with-grace'
import { stat } from 'node:fs/promises'
import inspector from 'node:inspector'
import { dirname, resolve as resolvePath } from 'node:path'
import { transform as v3Transform, transformV4 } from './lib/config.js'
import { NodeInspectorFlagsNotSupportedError } from './lib/errors.js'
import { Runtime } from './lib/runtime.js'
import { v4Schema } from './lib/schema.js'

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
  `--config` names a configuration; it does not widen what a configuration may be called. The four
  names are the format, and `resolveNamedConfigurationFile` is what refuses anything else -- it
  separates a legacy name, which gets the migrate hint, from an unrecognised one, which gets told
  what the four names are. Deciding here instead produced one of those answers for both.

  What `--config` does change is *where*: a named file need not sit where discovery would look.
*/
function isNamedConfigurationPath (path) {
  return /\.(json|json5|ya?ml|to?ml|js|mjs|ts|mts)$/.test(path)
}

async function findV4ConfigurationFile (configOrRoot, sourceOrConfig) {
  // A programmatic object source is not this path: the v4 object entry point is
  // loadObjectConfiguration, which skips the root eval worker entirely.
  if (sourceOrConfig && typeof sourceOrConfig !== 'string') {
    return null
  }

  if (typeof sourceOrConfig === 'string') {
    const named = resolvePath(configOrRoot, sourceOrConfig)

    // Named outright: the loader decides whether the name is one it accepts, and says which it is.
    return isNamedConfigurationPath(named) ? named : null
  }

  if (typeof configOrRoot !== 'string') {
    return null
  }

  if (isNamedConfigurationPath(configOrRoot)) {
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

  /*
    A v3 configuration found by the walk is refused, with the error that names migrate. It used to
    be swallowed so the v3 loader below could answer instead; that loader is gone, and the refusal
    is the correct answer again.
  */
  const deciding = await findDecidingFile(configOrRoot, { throwOnMissing: false })

  return deciding?.path ?? null
}

export async function loadConfiguration (configOrRoot, sourceOrConfig, context) {
  // Checked before the v3 resolver, which throws when it finds no v3 file — a v4-only project has
  // none by construction.
  const v4ConfigurationFile = await findV4ConfigurationFile(configOrRoot, sourceOrConfig)

  if (v4ConfigurationFile) {
    return loadV4RuntimeConfiguration(v4ConfigurationFile, context)
  }

  /*
    Level 0. A directory with no configuration file of any kind is not an error: the loader
    synthesizes one in memory from what the directory contains. Reaching the v3 resolver instead
    made a configless project fail to load, which is what the removed temporary-file fallback --
    detect the type, write a watt.json into the user's tree, then load that -- existed to paper
    over. Nothing is written to disk now.
  */
  if (!sourceOrConfig && typeof configOrRoot === 'string' && !isNamedConfigurationPath(configOrRoot)) {
    const stats = await stat(configOrRoot).catch(() => null)

    if (stats?.isDirectory()) {
      return loadV4RuntimeConfiguration({ cwd: configOrRoot }, context)
    }
  }

  const { root, source } = await resolve(configOrRoot, sourceOrConfig, 'runtime')

  /*
    A configuration handed over as an object rather than named as a file: what an embedder builds in
    memory, and what the ICC generates. There is nothing to evaluate, so it skips the root eval
    worker and joins the v4 pipeline at validation.
  */
  if (source && typeof source !== 'string') {
    return loadV4RuntimeConfiguration({ root, source }, context)
  }

  /*
    Everything above this point is v4. A path that reaches here named a file the v4 walk did not
    recognise as configuration, so the walk's own refusal is the answer -- it names the file and
    tells the reader to run migrate, which is more use than loading a v3 configuration into a
    runtime that no longer implements what it says.
  */
  throw new LegacyConfigurationFileError(source)
}

/*
  `target` is either a configuration file to evaluate or `{ root, source }` for a configuration
  handed over as an object -- what an embedder builds in memory and what the ICC generates. The two
  differ only in where the configuration comes from: an object skips the root eval worker, since
  there is nothing to evaluate, and everything after that is the same pipeline.
*/
async function loadV4RuntimeConfiguration (target, context) {
  /*
    The command decides `production` when the caller did not, rather than the other way round:
    `build` produces production artifacts, so a build that evaluated as a development boot read the
    development env files and gave every callback `production: false` while writing what `start`
    would later run.
  */
  const diagnostics = context?.logger ?? abstractLogger
  const explicitProduction = context?.isProduction ?? context?.production
  const command = context?.command ?? (explicitProduction ? 'start' : 'dev')
  const production = explicitProduction ?? isProductionCommand(command)

  /*
    The environment the loader treats as real. An embedder can add to it, and can ask for a
    hermetic runtime that sees none of this process's -- v3 honours both through loadEnv, and a v4
    runtime that ignored them would quietly hand every worker the parent's environment.
  */
  const realEnv = context?.ignoreProcessEnv ? { ...context?.env } : { ...process.env, ...context?.env }

  const objectSource = typeof target !== 'string' && target.source !== undefined
  const shared = {
    realEnv,
    command,
    mode: context?.mode,
    production,
    customEnvFile: context?.envFile,
    /*
      Step 3 of the pipeline validates orchestration in the eval worker, before autoload expansion
      acts on it -- without the schema that step is skipped, and a malformed `autoload` reaches the
      filesystem walk as a raw TypeError instead of a validation error naming the property.
    */
    schema: context?.schema ?? v4Schema,
    /*
      The evaluation deadline. A configuration that never resolves — an awaited fetch to a dead
      host, a forgotten promise — otherwise hangs the boot rather than failing it, and the default
      is a guess about how long a reasonable one takes. A deployment that knows better says so.
    */
    timeout: context?.configTimeout,
    // The one file --debug-config evaluates in this process when an inspector is attached, so a
    // breakpoint in it is reachable at all: a throwaway worker dies before one can attach.
    inProcessTarget: context?.inProcessTarget,
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
    /*
      These are the loader's user-facing diagnostics — the standalone-boot warning, the zero-config
      inference notice, the capability the detector chose — and they were being handed to
      abstractLogger, which is a no-op. Every one of them was discarded, including the warning the
      format relies on to tell someone that nothing the root says is being applied.

      A caller with a real logger passes it. The default stays silent because an embedder loading a
      configuration has not asked for anything on its stderr.
    */
    onWarning: warning => diagnostics.warn(warning.message),
    onInfo: info => diagnostics.info(info.message)
  }

  let loaded
  if (objectSource) {
    loaded = await loadV4ObjectConfiguration({ root: target.root, source: target.source, ...shared })
  } else if (typeof target === 'string') {
    loaded = await loadV4Configuration({ cwd: dirname(target), configPath: target, ...shared })
  } else {
    // No file was named and none was found: the loader searches from this directory and, finding
    // nothing, synthesizes.
    loaded = await loadV4Configuration({ cwd: target.cwd, ...shared })
  }

  const config = loaded.config

  /*
    The documented pipeline is validation with useDefaults, then kMetadata, then transform. The eval
    worker's own check is a shape check that injects nothing — deliberately, so the resolve
    projection carries authored values — so this is where the runtime schema's defaults arrive, and
    without it the runtime reaches for settings like gracefulShutdown that nothing supplied.
  */
  validateCapabilityConfiguration(config, context?.schema ?? v4Schema, {
    id: 'runtime',
    module: '@platformatic/runtime',
    root: loaded.root
  })

  // kMetadata is symbol-keyed and cannot cross a worker boundary, so each worker rebuilds it; this
  // is the main process's copy. env is the runtime's own view — the real environment under the root
  // env block and the root's env files — and every application worker gets the per-application
  // environment the loader resolved instead, which this one is not a substitute for.
  config[kMetadata] = {
    root: loaded.root,
    path: loaded.configPath,
    env: loaded.env ?? process.env,
    module: '@platformatic/runtime',
    /*
      The evaluation context, kept beside the envelope rather than inside it: applications added
      after boot are evaluated with the same command, mode and production flags the boot pass used,
      and its presence is also what tells the add path this runtime is v4 at all. A v3 runtime has
      no such context and keeps resolving configuration files worker-side.
    */
    v4: {
      command,
      mode: loaded.mode,
      production: loaded.production,
      /*
        Everything the evaluation actually read: the configuration files, their import graph minus
        node_modules, the env files consulted, and the directories whose membership decides the
        application list. `wattpm dev` reloads on any of it -- watching only the deciding file meant
        a config split across a helper module reloaded for none of its own edits.
      */
      watchTargets: loaded.watchTargets,
      /*
        Every entry carrying a `url`, recorded on the way past -- before the enabled filter, which
        is the point. `enabled` is the supported way to keep an application out of a boot, and an
        entry it hides from `resolve` is one whose clone never arrives.
      */
      resolveCandidates: loaded.resolveCandidates
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

    /*
      'exec' is every non-boot evaluation, and enumerating a capability's commands is one: nothing
      starts. Without it this evaluated as a development boot — development env files, and
      `production: false` handed to every callback — which is a context no invocation of these
      commands actually runs in.
    */
    config = await loadConfiguration(file, null, { command: 'exec' })

    /* c8 ignore next 3 - Hard to test */
    if (!config) {
      throw new Error('No runtime configuration file found.')
    }
  } catch {
    return { applications, commands, help }
  }

  for (const application of config.applications) {
    try {
      // A v4 application arrives with its configuration already evaluated and its capability
      // already named, so there is nothing to read and nothing to infer.
      const applicationConfig = application.resolvedConfig
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

/*
  The one entry point for an application added while the runtime is running -- what an extension
  calls before `addApplications`. It replaces the exported `prepareApplication`, which is the v3
  half of the same job: under v4 an added application has to be evaluated the way boot evaluates
  one, and an entry that skips that arrives without `resolvedConfig` and fails as an unhelpful
  "unable to initialize the worker".
*/
export { prepareAddedApplications } from './lib/config.js'

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
