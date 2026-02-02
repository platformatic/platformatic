import { RuntimeApiClient, getMatchingRuntime } from '@platformatic/control'
import { ensureLoggableError, logFatalError, parseArgs } from '@platformatic/foundation'
import { bold } from 'colorette'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { getSocket } from '../utils.js'

export async function pprofStartCommand (logger, args) {
  const client = new RuntimeApiClient(getSocket())

  try {
    const { positionals, values } = parseArgs(
      args,
      {
        type: { type: 'string', short: 't', default: 'cpu' },
        'source-maps': { type: 'boolean', short: 's', default: false },
        'node-modules-source-maps': { type: 'string', short: 'n' }
      },
      false
    )

    // Validate profile type
    const type = values.type
    if (type !== 'cpu' && type !== 'heap') {
      return logFatalError(logger, `Invalid profile type: ${type}. Must be 'cpu' or 'heap'.`)
    }

    const [runtime, remainingPositionals] = await getMatchingRuntime(client, positionals)
    const { applications: runtimeApplications } = await client.getRuntimeApplications(runtime.pid)

    // Get application ID from positional arguments or use all applications
    const applicationId = remainingPositionals[0]

    const options = { intervalMicros: 1000, type }

    // Add sourceMaps option if enabled
    if (values['source-maps']) {
      options.sourceMaps = true
    }

    // Add nodeModulesSourceMaps option if provided (comma-separated list of module names)
    if (values['node-modules-source-maps']) {
      options.nodeModulesSourceMaps = values['node-modules-source-maps'].split(',').map(s => s.trim())
    }

    if (applicationId) {
      // Start profiling for specific application
      const application = runtimeApplications.find(s => s.id === applicationId)
      if (!application) {
        return logFatalError(logger, `Application not found: ${applicationId}`)
      }

      await client.startApplicationProfiling(runtime.pid, applicationId, options)
      logger.info(`${type.toUpperCase()} profiling started for application ${bold(applicationId)}`)
    } else {
      // Start profiling for all applications
      for (const application of runtimeApplications) {
        try {
          await client.startApplicationProfiling(runtime.pid, application.id, options)
          logger.info(`${type.toUpperCase()} profiling started for application ${bold(application.id)}`)
        } catch (error) {
          logger.warn(`Failed to start profiling for application ${application.id}: ${error.message}`)
        }
      }
    }
  } catch (error) {
    if (error.code === 'PLT_CTR_RUNTIME_NOT_FOUND') {
      return logFatalError(logger, 'Cannot find a matching runtime.')
    } else if (error.message && error.message.includes('Application not found')) {
      return logFatalError(logger, error.message)
    } else {
      return logFatalError(logger, { error: ensureLoggableError(error) }, `Cannot start profiling: ${error.message}`)
    }
  } finally {
    await client.close()
  }
}

export async function pprofStopCommand (logger, args) {
  const client = new RuntimeApiClient(getSocket())

  try {
    const { positionals, values } = parseArgs(
      args,
      {
        type: { type: 'string', short: 't', default: 'cpu' },
        dir: { type: 'string', short: 'd' }
      },
      false
    )

    // Validate profile type
    const type = values.type
    if (type !== 'cpu' && type !== 'heap') {
      return logFatalError(logger, `Invalid profile type: ${type}. Must be 'cpu' or 'heap'.`)
    }

    const [runtime, remainingPositionals] = await getMatchingRuntime(client, positionals)
    const { applications: runtimeApplications } = await client.getRuntimeApplications(runtime.pid)

    // Get application ID from remaining positional arguments or use all applications
    const applicationId = remainingPositionals[0]
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-')
    const outputDir = values.dir || process.cwd()

    const options = { type }

    if (applicationId) {
      // Stop profiling for specific application
      const application = runtimeApplications.find(s => s.id === applicationId)
      if (!application) {
        return logFatalError(logger, `Application not found: ${applicationId}`)
      }

      const profileData = await client.stopApplicationProfiling(runtime.pid, applicationId, options)
      const filename = `pprof-${type}-${applicationId}-${timestamp}.pb`
      const filepath = resolve(outputDir, filename)
      await writeFile(filepath, Buffer.from(profileData))
      logger.info(
        `${type.toUpperCase()} profiling stopped for application ${bold(applicationId)}, profile saved to ${bold(filepath)}`
      )
      logger.info(`Run ${bold(`npx @platformatic/flame generate ${filepath}`)} to generate the flamegraph`)
    } else {
      // Stop profiling for all applications
      for (const application of runtimeApplications) {
        try {
          const profileData = await client.stopApplicationProfiling(runtime.pid, application.id, options)
          const filename = `pprof-${type}-${application.id}-${timestamp}.pb`
          const filepath = resolve(outputDir, filename)
          await writeFile(filepath, Buffer.from(profileData))
          logger.info(
            `${type.toUpperCase()} profiling stopped for application ${bold(application.id)}, profile saved to ${bold(filepath)}`
          )
          logger.info(`Run ${bold(`npx @platformatic/flame generate ${filepath}`)} to generate the flamegraph`)
        } catch (error) {
          logger.warn(`Failed to stop profiling for application ${application.id}: ${error.message}`)
        }
      }
    }
  } catch (error) {
    if (error.code === 'PLT_CTR_RUNTIME_NOT_FOUND') {
      return logFatalError(logger, 'Cannot find a matching runtime.')
    } else if (error.message && error.message.includes('Application not found')) {
      return logFatalError(logger, error.message)
    } else {
      return logFatalError(logger, { error: ensureLoggableError(error) }, `Cannot stop profiling: ${error.message}`)
    }
  } finally {
    await client.close()
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
    usage: 'pprof <start|stop> [id] [application] [options]',
    description: 'Profile CPU or heap usage of running application',
    options: [
      {
        name: '--type, -t',
        description: 'Profile type: "cpu" for CPU wall time (default) or "heap" for heap memory'
      },
      {
        name: '--source-maps, -s',
        description: 'Enable source map support to resolve TypeScript and other transpiled code locations in profiles'
      },
      {
        name: '--node-modules-source-maps, -n',
        description:
          'Comma-separated list of node_modules packages to load source maps from (e.g., "next,@next/next-server")'
      },
      {
        name: '--dir, -d',
        description:
          'Directory to save the profile data to (default: current working directory). Only used with "stop" subcommand.'
      }
    ],
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
        name: 'application',
        description: 'The application ID to profile (if omitted, profiles all applications)'
      }
    ],
    footer:
      'Use "pprof start [application]" to start profiling and "pprof stop [application]" to stop and save profile data.\n' +
      'Examples:\n' +
      '  wattpm pprof start --type=cpu my-app                              # Start CPU profiling\n' +
      '  wattpm pprof start --type=heap my-app                             # Start heap profiling\n' +
      '  wattpm pprof start --source-maps my-app                           # Start CPU profiling with source maps\n' +
      '  wattpm pprof start --type=cpu --source-maps my-app                # Start CPU profiling with source maps\n' +
      '  wattpm pprof start -s -n next,@next/next-server my-app            # Profile with Next.js source maps\n' +
      '  wattpm pprof stop --type=cpu my-app                               # Stop CPU profiling\n' +
      '  wattpm pprof stop --type=heap my-app                              # Stop heap profiling\n' +
      '  wattpm pprof stop --dir=/tmp/profiles my-app                      # Save profile to specific directory'
  }
}
