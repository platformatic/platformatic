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
async function printResolvedConfiguration (logger, root, configurationFile, { production, env }) {
  try {
    /*
      Under `node --inspect-brk`, the deciding file evaluates in this process so a breakpoint in it
      is reachable at all -- a throwaway worker dies before an inspector can attach. Exactly one
      file, because one process has one module cache, in which only a single file's env view can be
      correct; the rest still evaluate in their workers and the printed output is the same either
      way.
    */
    const inProcessTarget = inspector.url() ? configurationFile : undefined
    const config = await loadConfiguration(root, configurationFile, { production, envFile: env, inProcessTarget })
    console.log(JSON.stringify(config, null, 2))
  } catch (err) {
    logFatalError(logger, { error: ensureLoggableError(err) }, `Cannot resolve the configuration: ${err.message}`)
  }
}

export async function devCommand (logger, args) {
  const {
    values: { config, env, 'debug-config': debugConfig },
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
      }
    },
    false
  )
  const root = getRoot(positionals)

  const configurationFile = await findRuntimeConfigurationFile(logger, root, config, true, true, true, this.executableName)

  /* c8 ignore next 3 - Hard to test */
  if (!configurationFile) {
    return
  }
  if (debugConfig) {
    return printResolvedConfiguration(logger, root, configurationFile, { production: false, env })
  }

  /* c8 ignore next 15 - covered */

  let runtime
  try {
    runtime = await create(root, configurationFile, { start: true, envFile: env })
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

    watchers = [...targets.files, ...targets.directories].map(path => {
      const watcher = new FileWatcher({ path })
      watcher.startWatching()

      watcher.on('update', () => {
        runtime.logger.info('The configuration has changed, reloading the application ...')
        reloadApplication().catch(reject)
      })

      return watcher
    })
  }

  async function reloadApplication () {
    await Promise.all(watchers.map(watcher => watcher.stopWatching()))
    await runtime.close()
    runtime = await create(root, configurationFile, { start: true, reloaded: true, envFile: env })
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
    values: { inspect, config, env, 'debug-config': debugConfig }
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
      }
    },
    false
  )

  const root = getRoot(positionals)
  const configurationFile = await findRuntimeConfigurationFile(logger, root, config, true, true, true, this.executableName)

  /* c8 ignore next 3 - Hard to test */
  if (!configurationFile) {
    return
  }

  if (debugConfig) {
    return printResolvedConfiguration(logger, root, configurationFile, { production: true, env })
  }

  try {
    return await create(root, configurationFile, { start: true, production: true, inspect, envFile: env })
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
