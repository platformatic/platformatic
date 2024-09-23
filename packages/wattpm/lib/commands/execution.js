import { RuntimeApiClient } from '@platformatic/control'
import { startCommand as pltStartCommand } from '@platformatic/runtime'
import { ensureLoggableError } from '@platformatic/utils'
import { bold } from 'colorette'
import { spawn } from 'node:child_process'
import { watch } from 'node:fs/promises'
import { resolve } from 'node:path'
import { findConfigurationFile, getMatchingRuntimeArgs, parseArgs } from '../utils.js'

export async function devCommand (logger, args) {
  const { positionals } = parseArgs(args, {}, false)
  /* c8 ignore next */
  const root = resolve(process.cwd(), positionals[0] ?? '')

  const configurationFile = await findConfigurationFile(logger, root)
  let runtime = await pltStartCommand(['-c', configurationFile], true, true)

  // Add a watcher on the configurationFile so that we can eventually restart the runtime
  try {
    const watcher = watch(configurationFile, { persistent: false })
    // eslint-disable-next-line no-unused-vars
    for await (const _ of watcher) {
      runtime.logger.info('The configuration file has changed, reloading the application ...')
      await runtime.close()
      runtime = await pltStartCommand(['-c', configurationFile], true, true)
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return
    }
    throw err
  }
}

export async function startCommand (logger, args) {
  const { positionals } = parseArgs(args, {}, false)
  /* c8 ignore next */
  const root = resolve(process.cwd(), positionals[0] ?? '')

  const configurationFile = await findConfigurationFile(logger, root)
  await pltStartCommand(['--production', '-c', configurationFile], true)
}

export async function stopCommand (logger, args) {
  const { positionals } = parseArgs(args, {}, false)

  try {
    const client = new RuntimeApiClient()
    const runtime = await client.getMatchingRuntime(getMatchingRuntimeArgs(logger, positionals))

    await client.stopRuntime(runtime.pid)
    await client.close()

    logger.done(`Runtime ${bold(runtime.packageName)} have been stopped.`)
  } catch (error) {
    if (error.code === 'PLT_CTR_RUNTIME_NOT_FOUND') {
      logger.fatal('Cannot find a matching runtime.')
      /* c8 ignore next 3 */
    } else {
      logger.fatal({ error: ensureLoggableError(error) }, `Cannot stop the runtime: ${error.message}`)
    }
  }
}

export async function restartCommand (logger, args) {
  const { positionals } = parseArgs(args, {}, false)

  try {
    const client = new RuntimeApiClient()
    const runtime = await client.getMatchingRuntime(getMatchingRuntimeArgs(logger, positionals))

    await client.restartRuntime(runtime.pid)
    await client.close()

    logger.done(`Runtime ${bold(runtime.packageName)} have been restarted.`)
  } catch (error) {
    if (error.code === 'PLT_CTR_RUNTIME_NOT_FOUND') {
      logger.fatal('Cannot find a matching runtime.')
      /* c8 ignore next 3 */
    } else {
      logger.fatal({ error: ensureLoggableError(error) }, `Cannot restart the runtime: ${error.message}`)
    }
  }
}

export async function reloadCommand (logger, args) {
  const { positionals } = parseArgs(args, {}, false)

  try {
    const client = new RuntimeApiClient()
    const runtime = await client.getMatchingRuntime(getMatchingRuntimeArgs(logger, positionals))

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
    await client.close()

    logger.done(`Runtime ${bold(runtime.packageName)} have been reloaded and it is now running as PID ${child.pid}.`)
  } catch (error) {
    if (error.code === 'PLT_CTR_RUNTIME_NOT_FOUND') {
      logger.fatal('Cannot find a matching runtime.')
      /* c8 ignore next 3 */
    } else {
      logger.fatal({ error: ensureLoggableError(error) }, `Cannot reload the runtime: ${error.message}`)
    }
  }
}

export const help = {
  dev: {
    usage: 'dev [root]',
    description: 'Starts an application in development mode',
    args: [
      {
        name: 'root',
        description: 'The directory containing the application (default is the current directory)'
      }
    ]
  },
  start: {
    usage: 'start [root]',
    description: 'Starts an application in production mode',
    args: [
      {
        name: 'root',
        description: 'The directory containing the application (default is the current directory)'
      }
    ]
  },
  stop: {
    usage: 'stop [id]',
    description: 'Stops an application',
    args: [
      {
        name: 'id',
        description: 'The process ID or the name of the application'
      }
    ]
  },
  restart: {
    usage: 'restart [id]',
    description: 'Restarts all services of an application',
    args: [
      {
        name: 'id',
        description: 'The process ID or the name of the application'
      }
    ]
  },
  reload: {
    usage: 'reload [id]',
    description: 'Reloads an application',
    args: [
      {
        name: 'id',
        description: 'The process ID or the name of the application'
      }
    ]
  }
}
