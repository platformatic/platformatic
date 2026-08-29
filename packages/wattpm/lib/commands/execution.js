import { getMatchingRuntime, RuntimeApiClient } from '@platformatic/control'
import {
  ensureLoggableError,
  FileWatcher,
  findRuntimeConfigurationFile,
  getRoot,
  logFatalError,
  parseArgs
} from '@platformatic/foundation'
import { create, loadConfiguration } from '@platformatic/runtime'
import { bold } from 'colorette'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { basename, dirname, resolve, sep } from 'node:path'
import inspector from 'node:inspector'
import { createInterface } from 'node:readline'

/*
  --debug-config prints the fully resolved configuration and boots nothing. It goes through the
  same loader a real boot does — eval worker, per-file isolation, the env ladder — because a
  diagnostic that resolves configuration its own way is a diagnostic that agrees with the boot
  right up until it matters.

  The output includes whatever the environment supplied, so it is as sensitive as the environment
  itself. kMetadata is symbol-keyed and JSON.stringify drops it, which is the intent: the envelope
  is loader bookkeeping, not configuration.
*/
/*
  The evaluation deadline as a number of milliseconds. Left undefined when unset so the loader's own
  default applies rather than NaN, which would disable the deadline entirely — the one outcome the
  flag must not be able to produce by accident.
*/
function parseConfigTimeout (value) {
  if (value === undefined) {
    return undefined
  }

  const timeout = Number(value)

  return Number.isFinite(timeout) && timeout > 0 ? timeout : undefined
}

async function printResolvedConfiguration (logger, root, configurationFile, { production, env, configTimeout, mode }) {
  try {
    /*
      Under `node --inspect-brk`, the deciding file evaluates in this process so a breakpoint in it
      is reachable at all -- a throwaway worker dies before an inspector can attach. Exactly one
      file, because one process has one module cache, in which only a single file's env view can be
      correct; the rest still evaluate in their workers and the printed output is the same either
      way.
    */
    const inProcessTarget = inspector.url() ? configurationFile : undefined
    /*
      No logger here on purpose: this command's output is the configuration as JSON on stdout, and
      the CLI logger writes there too. The scope announcement belongs to a boot — this boots
      nothing — and interleaving it would break the one consumer that output has.
    */
    const config = await loadConfiguration(root, configurationFile, { production, envFile: env, inProcessTarget, configTimeout, mode })
    console.log(JSON.stringify(config, null, 2))
  } catch (err) {
    logFatalError(logger, { error: ensureLoggableError(err) }, `Cannot resolve the configuration: ${err.message}`)
  }
}

export async function devCommand (logger, args) {
  const {
    values: { config, env, 'debug-config': debugConfig, 'config-timeout': configTimeout, mode },
    positionals
  } = parseArgs(
    args,
    {
      config: {
        type: 'string',
        short: 'c'
      },
      env: {
        type: 'string',
        short: 'e'
      },
      'debug-config': {
        type: 'boolean'
      },
      'config-timeout': {
        type: 'string'
      },
      mode: {
        type: 'string'
      }
    },
    false
  )
  const root = getRoot(positionals)

  const configurationFile = await findRuntimeConfigurationFile(logger, root, config, true, true, true, this.executableName)

  /*
    null means no configuration file exists anywhere above the root, which is Level 0 rather than a
    failure: the loader is handed the directory and synthesizes a configuration for it in memory.
    `false` is the other answer — the lookup already reported why it refused.
  */
  if (configurationFile === false) {
    return
  }

  if (debugConfig) {
    return printResolvedConfiguration(logger, root, configurationFile, {
      production: false,
      env,
      mode,
      configTimeout: parseConfigTimeout(configTimeout)
    })
  }

  /* c8 ignore next 15 - covered */

  let runtime
  try {
    runtime = await create(root, configurationFile, { start: true, envFile: env, logger, mode, configTimeout: parseConfigTimeout(configTimeout) })
  } catch (err) {
    logFatalError(logger, { error: ensureLoggableError(err) }, `Cannot start the application: ${err.message}`)
    return
  }

  // Handle reloading via either file changes or stdin "rs" command
  const { promise, reject } = Promise.withResolvers()

  let watchers = []

  /*
    v4 reports everything the evaluation read -- the configuration files, their import graph minus
    node_modules, the env files consulted, and the directories whose membership decides the
    application list. Watching only the deciding file meant a configuration split across a helper
    module, or one reading a `.env`, reloaded for none of its own edits. v3 reports the deciding
    file alone, which is exactly what this watched before.

    They are re-armed after every reload, because the set is a property of the configuration that
    was just evaluated: an edit can add an import, and the watcher for it has to exist before the
    next edit rather than after.
  */
  function watchConfiguration () {
    const targets = runtime.getConfigurationWatchTargets()

    /*
      Some of the set does not exist yet, and that is the point: creating a `.env` beside the
      configuration, or a `watt.config.ts` in an ancestor, changes the answer without changing any
      file that is there now. Those are watched through their directory, filtered to the names that
      matter, because a watcher cannot be opened on a path that has nothing at it -- fs.watch throws
      ENOENT rather than waiting.
    */
    const specs = []
    const prospective = new Map()

    for (const file of targets.files) {
      if (existsSync(file)) {
        specs.push({ path: file })
        continue
      }

      const directory = dirname(file)

      if (!prospective.has(directory)) {
        prospective.set(directory, [])
      }

      prospective.get(directory).push(basename(file))
    }

    for (const [directory, names] of prospective) {
      if (existsSync(directory)) {
        specs.push({ path: directory, allowToWatch: names })
      }
    }

    /*
      A watched *directory* is watched for membership: an application directory appearing or
      disappearing changes the application list, and that is a configuration change. What happens
      *inside* one is not -- that is the application's own source, which its worker watches and
      restarts itself for.

      The distinction is the depth of the change, because the watcher reports paths relative to what
      it watches: `main` is a member, `main/index.js` is inside one. Without it every edit to any
      file under an autoloaded directory reloaded the whole runtime, which both restarted far more
      than the edit touched and stopped the application's own watcher from ever getting there.
    */
    for (const directory of targets.directories) {
      if (existsSync(directory)) {
        specs.push({ path: directory, membershipOnly: true })
      }
    }

    /*
      The files the evaluation actually read. A change to one of them is a configuration change
      wherever it sits -- including inside an autoloaded directory, which is where every
      application's own configuration file lives.
    */
    const known = new Set(targets.files)

    watchers = specs.map(({ membershipOnly, ...spec }) => {
      const watcher = new FileWatcher(spec)
      watcher.startWatching()

      watcher.on('update', changed => {
        if (membershipOnly && typeof changed === 'string' && changed.includes(sep)) {
          if (!known.has(resolve(spec.path, changed))) {
            return
          }
        }

        runtime.logger.info('The configuration has changed, reloading the application ...')
        reloadApplication().catch(reject)
      })

      return watcher
    })
  }

  /*
    One reload at a time. A single edit reaches more than one watcher -- the file has its own, and
    the directory holding it is watched for membership -- so two reloads would start, and the second
    runtime would try to bind a management socket the first had not released. Coalescing them is
    also what the user means: the tree changed once.
  */
  let reloading = null

  function reloadApplication () {
    reloading ??= reloadOnce().finally(() => {
      reloading = null
    })

    return reloading
  }

  async function reloadOnce () {
    await Promise.all(watchers.map(watcher => watcher.stopWatching()))
    await runtime.close()

    try {
      runtime = await create(root, configurationFile, { start: true, reloaded: true, envFile: env, logger, mode, configTimeout: parseConfigTimeout(configTimeout) })
    } catch (error) {
      /*
        A configuration that no longer evaluates -- a half-typed edit is the ordinary case -- must
        not take the dev server down with it. The failure is reported and the watchers are re-armed
        against the targets the last good configuration named, so saving a corrected file starts the
        runtime again. v3 had the same guarantee for a different reason: it read an application's
        configuration in that application's worker, so a file that stopped parsing broke one worker
        rather than the process.
      */
      logger.error({ err: ensureLoggableError(error) }, `Cannot reload the application: ${error.message}`)
      watchConfiguration()
      return
    }

    watchConfiguration()
  }

  watchConfiguration()

  const rl = createInterface({ input: process.stdin })
  rl.on('line', line => {
    if (line.trim() !== 'rs') {
      return
    }

    runtime.logger.info('Received "rs" from the stdin, Reloading the application ...')
    reloadApplication().catch(reject)
  })

  return promise
}

export async function startCommand (logger, args) {
  const {
    positionals,
    values: { inspect, config, env, 'debug-config': debugConfig, 'config-timeout': configTimeout, mode }
  } = parseArgs(
    args,
    {
      config: {
        type: 'string',
        short: 'c'
      },
      inspect: {
        type: 'boolean',
        short: 'i'
      },
      env: {
        type: 'string',
        short: 'e'
      },
      'debug-config': {
        type: 'boolean'
      },
      'config-timeout': {
        type: 'string'
      },
      mode: {
        type: 'string'
      }
    },
    false
  )

  const root = getRoot(positionals)
  const configurationFile = await findRuntimeConfigurationFile(logger, root, config, true, true, true, this.executableName)

  /*
    null means no configuration file exists anywhere above the root, which is Level 0 rather than a
    failure: the loader is handed the directory and synthesizes a configuration for it in memory.
    `false` is the other answer — the lookup already reported why it refused.
  */
  if (configurationFile === false) {
    return
  }

  if (debugConfig) {
    return printResolvedConfiguration(logger, root, configurationFile, {
      production: true,
      env,
      mode,
      configTimeout: parseConfigTimeout(configTimeout)
    })
  }

  try {
    return await create(root, configurationFile, { start: true, production: true, inspect, envFile: env, logger, mode, configTimeout: parseConfigTimeout(configTimeout) })
  } catch (err) {
    logFatalError(logger, { error: ensureLoggableError(err) }, `Cannot start the application: ${err.message}`)
  }
}

export async function stopCommand (logger, args) {
  const { positionals } = parseArgs(args, {}, false)

  const client = new RuntimeApiClient({ logger, socket: this.socket })
  try {
    const [runtime] = await getMatchingRuntime(client, positionals)

    await client.stopRuntime(runtime.pid)

    logger.done(`Runtime ${bold(runtime.packageName)} have been stopped.`)
  } catch (error) {
    if (error.code === 'PLT_CTR_RUNTIME_NOT_FOUND') {
      return logFatalError(logger, 'Cannot find a matching runtime.')
      /* c8 ignore next 3 - Hard to test */
    } else {
      return logFatalError(logger, { error: ensureLoggableError(error) }, `Cannot stop the runtime: ${error.message}`)
    }
  } finally {
    await client.close()
  }
}

export async function restartCommand (logger, args) {
  const { positionals } = parseArgs(args, {}, false)

  const client = new RuntimeApiClient({ logger, socket: this.socket })
  try {
    const [runtime, applications] = await getMatchingRuntime(client, positionals)

    await client.restartRuntime(runtime.pid, ...applications)

    logger.done(`Runtime ${bold(runtime.packageName)} has been restarted.`)
  } catch (error) {
    if (error.code === 'PLT_CTR_RUNTIME_NOT_FOUND') {
      return logFatalError(logger, 'Cannot find a matching runtime.')
      /* c8 ignore next 7 - Hard to test */
    } else {
      return logFatalError(
        logger,
        { error: ensureLoggableError(error) },
        `Cannot restart the runtime: ${error.message}`
      )
    }
  } finally {
    await client.close()
  }
}

export async function reloadCommand (logger, args) {
  const { positionals } = parseArgs(args, {}, false)

  const client = new RuntimeApiClient({ logger, socket: this.socket })
  try {
    const [runtime] = await getMatchingRuntime(client, positionals)

    // Stop the previous runtime
    await client.stopRuntime(runtime.pid)

    // Start the new runtime
    const [startCommand, ...startArgs] = runtime.argv
    const child = spawn(startCommand, startArgs, { cwd: runtime.cwd, stdio: 'ignore', detached: true })

    // Wait for the process to go up
    await new Promise((resolve, reject) => {
      child.on('spawn', resolve)
      child.on('error', reject)
    })

    child.unref()

    logger.done(`Runtime ${bold(runtime.packageName)} have been reloaded and it is now running as PID ${child.pid}.`)
  } catch (error) {
    if (error.code === 'PLT_CTR_RUNTIME_NOT_FOUND') {
      return logFatalError(logger, 'Cannot find a matching runtime.')
      /* c8 ignore next 3 - Hard to test */
    } else {
      return logFatalError(logger, { error: ensureLoggableError(error) }, `Cannot reload the runtime: ${error.message}`)
    }
  } finally {
    await client.close()
  }
}

export const help = {
  dev: {
    usage: 'dev [root]',
    description: 'Starts an application in development mode',
    args: [
      {
        name: 'root',
        description: 'The directory containing the project (the default is the current directory)'
      }
    ],
    options: [
      {
        usage: '-c, --config <config>',
        description: 'Name of the configuration file to use (the default to autodetect it)'
      },
      {
        usage: '-e, --env <path>',
        description: 'Path to a custom .env file to load environment variables from'
      },
      {
        usage: '--debug-config',
        description: 'Prints the fully resolved configuration and exits without starting anything'
      },
      {
        usage: '--config-timeout <ms>',
        description: 'How long configuration evaluation may take before the load fails (the default is 30000)'
      },
      {
        usage: '--mode <name>',
        description: 'The mode to select environment files with (the default is development for dev, production otherwise)'
      }
    ]
  },
  start: {
    usage: 'start [root]',
    description: 'Starts an application in production mode',
    args: [
      {
        name: 'root',
        description: 'The directory containing the project (the default is the current directory)'
      }
    ],
    options: [
      {
        usage: '-c, --config <config>',
        description: 'Name of the configuration file to use (the default to autodetect it)'
      },
      {
        usage: '-i --inspect',
        description: 'Enables the inspector for each application'
      },
      {
        usage: '-e, --env <path>',
        description: 'Path to a custom .env file to load environment variables from'
      },
      {
        usage: '--debug-config',
        description: 'Prints the fully resolved configuration and exits without starting anything'
      },
      {
        usage: '--config-timeout <ms>',
        description: 'How long configuration evaluation may take before the load fails (the default is 30000)'
      },
      {
        usage: '--mode <name>',
        description: 'The mode to select environment files with (the default is development for dev, production otherwise)'
      }
    ]
  },
  stop: {
    usage: 'stop [id]',
    description: 'Stops a running application',
    args: [
      {
        name: 'id',
        description:
          'The process ID or the name of the application (it can be omitted only if there is a single application running)'
      }
    ]
  },
  restart: {
    usage: 'restart [id] [application...]',
    description: 'Restarts applications',
    footer:
      'All applications are restarted in parallel, and within each application, workers are replaced one at a time.',
    args: [
      {
        name: 'id',
        description:
          'The process ID or the name of the application (it can be omitted only if there is a single application running)'
      },
      {
        name: 'application',
        description: 'The name of the application to restart (if omitted, all applications are restarted)'
      }
    ]
  },
  reload: {
    usage: 'reload [id]',
    description: 'Reloads a running application',
    args: [
      {
        name: 'id',
        description:
          'The process ID or the name of the application (it can be omitted only if there is a single application running)'
      }
    ]
  }
}
