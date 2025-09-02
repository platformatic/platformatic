import { RuntimeApiClient } from '@platformatic/control'
import { ensureLoggableError } from '@platformatic/utils'
import { bold } from 'colorette'
import { writeFile } from 'node:fs/promises'
import { getMatchingRuntime, logFatalError, parseArgs } from '../utils.js'
import { createRequire } from 'node:module'

export async function pprofStartCommand (logger, args) {
  try {
    const { positionals } = parseArgs(args, {}, false)

    const client = new RuntimeApiClient()
    const [runtime, remainingPositionals] = await getMatchingRuntime(client, positionals)
    const { services: runtimeServices } = await client.getRuntimeServices(runtime.pid)

    // Get service ID from remaining positional arguments or use all services
    const serviceId = remainingPositionals[0]

    if (serviceId) {
      // Start profiling for specific service
      const service = runtimeServices.find(s => s.id === serviceId)
      if (!service) {
        await client.close()
        return logFatalError(logger, `Service not found: ${serviceId}`)
      }

      await client.startServiceProfiling(runtime.pid, serviceId, { intervalMicros: 1000 })
      logger.info(`Profiling started for service ${bold(serviceId)}`)
    } else {
      // Start profiling for all services
      for (const service of runtimeServices) {
        try {
          await client.startServiceProfiling(runtime.pid, service.id, { intervalMicros: 1000 })
          logger.info(`Profiling started for service ${bold(service.id)}`)
        } catch (err) {
          const cwd = runtime.cwd
          const require = createRequire(cwd)
          try {
            require.resolve('@platoformatic/wattp-pprof-capture')
          } catch {
            logger.warn('To enable profiling, please install the @platformatic/watt-pprof-capture package in your project and restart: npm install @platformatic/watt-pprof-capture')
            break
          }
          logger.warn({ err }, `Failed to start profiling for service ${service.id}`)
        }
      }
    }

    await client.close()
  } catch (error) {
    if (error.code === 'PLT_CTR_RUNTIME_NOT_FOUND') {
      return logFatalError(logger, 'Cannot find a matching runtime.')
    } else if (error.message && (error.message.includes('Service not found'))) {
      return logFatalError(logger, error.message)
    } else {
      return logFatalError(logger, { error: ensureLoggableError(error) }, `Cannot start profiling: ${error.message}`)
    }
  }
}

export async function pprofStopCommand (logger, args) {
  try {
    const { positionals } = parseArgs(args, {}, false)

    const client = new RuntimeApiClient()
    const [runtime, remainingPositionals] = await getMatchingRuntime(client, positionals)
    const { services: runtimeServices } = await client.getRuntimeServices(runtime.pid)

    // Get service ID from remaining positional arguments or use all services
    const serviceId = remainingPositionals[0]
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-')

    if (serviceId) {
      // Stop profiling for specific service
      const service = runtimeServices.find(s => s.id === serviceId)
      if (!service) {
        await client.close()
        return logFatalError(logger, `Service not found: ${serviceId}`)
      }

      const profileData = await client.stopServiceProfiling(runtime.pid, serviceId)
      const filename = `pprof-${serviceId}-${timestamp}.pb`
      await writeFile(filename, Buffer.from(profileData))
      logger.info(`Profiling stopped for service ${bold(serviceId)}, profile saved to ${bold(filename)}`)
    } else {
      // Stop profiling for all services
      for (const service of runtimeServices) {
        try {
          const profileData = await client.stopServiceProfiling(runtime.pid, service.id)
          const filename = `pprof-${service.id}-${timestamp}.pb`
          await writeFile(filename, Buffer.from(profileData))
          logger.info(`Profiling stopped for service ${bold(service.id)}, profile saved to ${bold(filename)}`)
        } catch (error) {
          logger.warn(`Failed to stop profiling for service ${service.id}: ${error.message}`)
        }
      }
    }

    await client.close()
  } catch (error) {
    if (error.code === 'PLT_CTR_RUNTIME_NOT_FOUND') {
      return logFatalError(logger, 'Cannot find a matching runtime.')
    } else if (error.message && (error.message.includes('Service not found'))) {
      return logFatalError(logger, error.message)
    } else {
      return logFatalError(logger, { error: ensureLoggableError(error) }, `Cannot stop profiling: ${error.message}`)
    }
  }
}

export async function pprofCommand (logger, args) {
  if (args.length === 0) {
    // Show help when no subcommand is provided
    logger.info('Available pprof commands:')
    logger.info('  pprof start [id] [service] - Start profiling')
    logger.info('  pprof stop [id] [service]  - Stop profiling and save profile')
    process.exit(1)
  }

  const [subcommand, ...restArgs] = args

  switch (subcommand) {
    case 'start':
      return pprofStartCommand(logger, restArgs)
    case 'stop':
      return pprofStopCommand(logger, restArgs)
    default:
      logger.error(`Unknown pprof subcommand: ${subcommand}`)
      logger.info('Available pprof commands:')
      logger.info('  pprof start [id] [service] - Start profiling')
      logger.info('  pprof stop [id] [service]  - Stop profiling and save profile')
      process.exit(1)
  }
}

export const help = {
  pprof: {
    usage: 'pprof <start|stop> [id] [service]',
    description: 'Profile CPU usage of running services',
    options: [],
    args: [
      {
        name: 'command',
        description: 'The pprof command to run: start or stop'
      },
      {
        name: 'id',
        description: 'The process ID or the name of the application (it can be omitted only if there is a single application running)'
      },
      {
        name: 'service',
        description: 'The service ID to profile (if omitted, profiles all services)'
      }
    ],
    footer: 'Use "pprof start [id] [service]" to start profiling and "pprof stop [id] [service]" to stop and save profile data.'
  }
}
