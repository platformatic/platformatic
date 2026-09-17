import { dirname } from 'node:path'
import { CannotParseConfigFileError, RootMissingError, SourceMissingError } from '../errors.js'
import { kMetadata } from '../symbols.js'
import { NotASingleApplicationError } from './errors.js'
import { loadConfiguration } from './load.js'

/*
  One application's configuration read from a file, in the shape a worker receives it: the
  capability's own validated configuration, where it lives, and the environment the loader resolved
  for it.

  A capability's CLI commands start here when they are pointed at a file rather than handed the
  configuration the runtime already resolved -- `plt db migrations apply -c watt.config.mjs` rather
  than `wattpm db:migrations:apply`. The file is a program, so there is nothing to parse: it is
  evaluated by the same loader a boot uses, and the answer is the same one the boot would produce.

  The default command is `exec`, which is what every non-boot evaluation is: nothing starts, so a
  configuration branching on `command` sees a context that matches what is actually happening.
*/
export async function loadApplicationConfigurationFile (path, options = {}) {
  const loaded = await loadConfiguration({
    cwd: dirname(path),
    configPath: path,
    command: 'exec',
    ...options
  })

  const applications = loaded.config.applications ?? []

  /*
    Exactly one, because a command reads one application's configuration and cannot be asked to
    guess which. A root that describes several is not an error to load -- it is an error to point
    this at, which is what the message says.
  */
  if (applications.length !== 1) {
    throw new NotASingleApplicationError(
      path,
      applications.length,
      applications.map(application => application.id).join(', ') || 'none'
    )
  }

  const [application] = applications

  return {
    root: application.path,
    config: application.config ?? {},
    env: application.workerEnv ?? {},
    module: application.module,
    loaded
  }
}

/*
  The capability half of a v4 load: everything that happens to an application's configuration after
  the loader has produced it.

  It is deliberately small, and its size is the point. The v3 reader did fourteen things here --
  read a document off disk, walk for `.env` files, substitute `{PLT_X}`, enforce strictEnv, upgrade
  by `$schema` version, validate with coercion on -- and under v4 every one of them has already
  happened, main-side, exactly once. What is left is the capability's own transform and the metadata
  it reads its root from.

  `env` is the environment the loader resolved for this application, not the process's. A capability
  asked for `process.env` here would report a different environment than the worker actually runs
  with, which is the thing evaluating configuration once was meant to make impossible.
*/
export async function applyResolvedConfiguration (root, config, { schema, transform, env = {}, context } = {}) {
  if (typeof config === 'undefined' || config === null) {
    throw new SourceMissingError()
  }

  if (typeof root !== 'string' || root.length === 0) {
    throw new RootMissingError()
  }

  config[kMetadata] = {
    root,
    env: { ...env },
    // A v4 configuration is not a file the capability reads, so there is no path to report.
    path: null,
    module: typeof config.module === 'string' ? config.module : null
  }

  if (typeof transform !== 'function') {
    return config
  }

  try {
    /*
      The context reaches the transform, because capabilities read it there: node folds
      `tracingConfig` into the application's own tracing block, and a transform handed only a
      root silently produces a configuration with none.
    */
    return await transform(config, schema, { ...context, root })
  } catch (error) {
    throw new CannotParseConfigFileError(error.message, { cause: error })
  }
}
