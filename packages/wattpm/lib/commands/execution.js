import { getMatchingRuntime, RuntimeApiClient } from '@platformatic/control'
import {
  ensureLoggableError,
  FileWatcher,
  findRuntimeConfigurationFile,
  getRoot,
  logFatalError,
  parseArgs
} from '@platformatic/foundation'
import { create } from '@platformatic/runtime'
import { bold } from 'colorette'
import { spawn } from 'node:child_process'
import { on } from 'node:events'

export async function devCommand (logger, args) {
  const {
    values: { config },
    positionals
  } = parseArgs(
    args,
    {
      config: {
        type: 'string',
        short: 'c'
      }
    },
    false
  )
  const root = getRoot(positionals)

  const configurationFile = await findRuntimeConfigurationFile(logger, root, config)

  /* c8 ignore next 3 - Hard to test */
  if (!configurationFile) {
    return
  }
  /* c8 ignore next 15 - covered */

  let runtime = await create(root, configurationFile, { start: true })

  // Add a watcher on the configurationFile so that we can eventually restart the runtime
  const watcher = new FileWatcher({ path: configurationFile })
  watcher.startWatching()

  // eslint-disable-next-line no-unused-vars
  for await (const _ of on(watcher, 'update')) {
    runtime.logger.info('The configuration file has changed, reloading the application ...')
    await runtime.close()
    runtime = await create(root, configurationFile, { start: true })
  }
}

export async function startCommand (logger, args) {
  const {
    positionals,
    values: { inspect, config }
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
      }
    },
    false
  )

  const root = getRoot(positionals)
  const configurationFile = await findRuntimeConfigurationFile(logger, root, config)

  /* c8 ignore next 3 - Hard to test */
  if (!configurationFile) {
    return
  }

  await create(root, configurationFile, { start: true, production: true, inspect })
}

export async function stopCommand (logger, args) {
  const { positionals } = parseArgs(args, {}, false)

  const client = new RuntimeApiClient()
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

  const client = new RuntimeApiClient()
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

  const client = new RuntimeApiClient()
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
