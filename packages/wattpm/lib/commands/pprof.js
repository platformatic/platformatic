import { RuntimeApiClient, getMatchingRuntime } from '@platformatic/control'
import { ensureLoggableError, logFatalError, parseArgs } from '@platformatic/foundation'
import { bold } from 'colorette'
import { writeFile } from 'node:fs/promises'

export async function pprofStartCommand (logger, args) {
  try {
    const { positionals } = parseArgs(args, {}, false)

    const client = new RuntimeApiClient()
    const [runtime, remainingPositionals] = await getMatchingRuntime(client, positionals)
    const { applications: runtimeApplications } = await client.getRuntimeApplications(runtime.pid)

    // Get application ID from positional arguments or use all applications
    const applicationId = remainingPositionals[0]

    if (applicationId) {
      // Start profiling for specific application
      const application = runtimeApplications.find(s => s.id === applicationId)
      if (!application) {
        await client.close()
        return logFatalError(logger, `Application not found: ${applicationId}`)
      }

      await client.startApplicationProfiling(runtime.pid, applicationId, { intervalMicros: 1000 })
      logger.info(`Profiling started for application ${bold(applicationId)}`)
    } else {
      // Start profiling for all applications
      for (const application of runtimeApplications) {
        try {
          await client.startApplicationProfiling(runtime.pid, application.id, { intervalMicros: 1000 })
          logger.info(`Profiling started for application ${bold(application.id)}`)
        } catch (error) {
          logger.warn(`Failed to start profiling for application ${application.id}: ${error.message}`)
        }
      }
    }

    await client.close()
  } catch (error) {
    if (error.code === 'PLT_CTR_RUNTIME_NOT_FOUND') {
      return logFatalError(logger, 'Cannot find a matching runtime.')
    } else if (error.message && error.message.includes('Application not found')) {
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
    const { applications: runtimeApplications } = await client.getRuntimeApplications(runtime.pid)

    // Get application ID from remaining positional arguments or use all applications
    const applicationId = remainingPositionals[0]
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-')

    if (applicationId) {
      // Stop profiling for specific application
      const application = runtimeApplications.find(s => s.id === applicationId)
      if (!application) {
        await client.close()
        return logFatalError(logger, `Application not found: ${applicationId}`)
      }

      const profileData = await client.stopApplicationProfiling(runtime.pid, applicationId)
      const filename = `pprof-${applicationId}-${timestamp}.pb`
      await writeFile(filename, Buffer.from(profileData))
      logger.info(`Profiling stopped for application ${bold(applicationId)}, profile saved to ${bold(filename)}`)
    } else {
      // Stop profiling for all applications
      for (const application of runtimeApplications) {
        try {
          const profileData = await client.stopApplicationProfiling(runtime.pid, application.id)
          const filename = `pprof-${application.id}-${timestamp}.pb`
          await writeFile(filename, Buffer.from(profileData))
          logger.info(`Profiling stopped for application ${bold(application.id)}, profile saved to ${bold(filename)}`)
        } catch (error) {
          logger.warn(`Failed to stop profiling for application ${application.id}: ${error.message}`)
        }
      }
    }

    await client.close()
  } catch (error) {
    if (error.code === 'PLT_CTR_RUNTIME_NOT_FOUND') {
      return logFatalError(logger, 'Cannot find a matching runtime.')
    } else if (error.message && error.message.includes('Application not found')) {
      return logFatalError(logger, error.message)
    } else {
      return logFatalError(logger, { error: ensureLoggableError(error) }, `Cannot stop profiling: ${error.message}`)
    }
  }
}

export async function pprofCommand (logger, args) {
  const [subcommand, ...restArgs] = args

  switch (subcommand) {
    case 'start':
      return pprofStartCommand(logger, restArgs)
    case 'stop':
      return pprofStopCommand(logger, restArgs)
    default:
      return logFatalError(logger, `Please provide a pprof subcommand between ${bold('start')} and ${bold('stop')}.`)
  }
}

export const help = {
  pprof: {
    usage: 'pprof <start|stop> [id] [application]',
    description: 'Profile CPU usage of running application',
    options: [],
    args: [
      {
        name: 'command',
        description: 'The pprof command to run: start or stop'
      },
      {
        name: 'id',
        description:
          'The process ID or the name of the application (it can be omitted only if there is a single application running)'
      },
      {
        name: 'id',
        description:
          'The process ID or the name of the application (it can be omitted only if there is a single application running)'
      },
      {
        name: 'application',
        description: 'The application ID to profile (if omitted, profiles all applications)'
      }
    ],
    footer:
      'Use "pprof start [application]" to start profiling and "pprof stop [application]" to stop and save profile data.'
  }
}
