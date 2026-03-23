import { RuntimeApiClient, getMatchingRuntime } from '@platformatic/control'
import { ensureLoggableError, logFatalError, parseArgs } from '@platformatic/foundation'
import { bold } from 'colorette'
import { createWriteStream } from 'node:fs'
import { resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'

export async function heapSnapshotCommand (logger, args) {
  const client = new RuntimeApiClient({ logger, socket: this.socket })

  try {
    const { positionals, values } = parseArgs(
      args,
      {
        dir: { type: 'string', short: 'd' }
      },
      false
    )

    const [runtime, remainingPositionals] = await getMatchingRuntime(client, positionals)
    const { applications: runtimeApplications } = await client.getRuntimeApplications(runtime.pid)

    const applicationId = remainingPositionals[0]
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-')
    const outputDir = values.dir || process.cwd()

    if (applicationId) {
      const application = runtimeApplications.find(s => s.id === applicationId)
      if (!application) {
        return logFatalError(logger, `Application not found: ${applicationId}`)
      }

      logger.info(`Taking heap snapshot for application ${bold(applicationId)}...`)
      const body = await client.takeApplicationHeapSnapshot(runtime.pid, applicationId)
      const filename = `heap-${applicationId}-${timestamp}.heapsnapshot`
      const filepath = resolve(outputDir, filename)
      await pipeline(body, createWriteStream(filepath))
      logger.info(`Heap snapshot saved to ${bold(filepath)}`)
    } else {
      for (const application of runtimeApplications) {
        try {
          logger.info(`Taking heap snapshot for application ${bold(application.id)}...`)
          const body = await client.takeApplicationHeapSnapshot(runtime.pid, application.id)
          const filename = `heap-${application.id}-${timestamp}.heapsnapshot`
          const filepath = resolve(outputDir, filename)
          await pipeline(body, createWriteStream(filepath))
          logger.info(`Heap snapshot saved to ${bold(filepath)}`)
        } catch (error) {
          logger.warn(`Failed to take heap snapshot for application ${application.id}: ${error.message}`)
        }
      }
    }
  } catch (error) {
    if (error.code === 'PLT_CTR_RUNTIME_NOT_FOUND') {
      return logFatalError(logger, 'Cannot find a matching runtime.')
    } else if (error.message && error.message.includes('Application not found')) {
      return logFatalError(logger, error.message)
    } else {
      return logFatalError(
        logger,
        { error: ensureLoggableError(error) },
        `Cannot take heap snapshot: ${error.message}`
      )
    }
  } finally {
    await client.close()
  }
}

export const help = {
  'heap-snapshot': {
    usage: 'heap-snapshot [id] [application] [options]',
    description: 'Take a heap snapshot of a running application',
    options: [
      {
        usage: '--dir, -d',
        description: 'Directory to save the heap snapshot to (default: current working directory)'
      }
    ],
    args: [
      {
        name: 'id',
        description:
          'The process ID or the name of the application (it can be omitted only if there is a single application running)'
      },
      {
        name: 'application',
        description: 'The application ID to snapshot (if omitted, snapshots all applications)'
      }
    ],
    footer:
      'Takes a V8 heap snapshot of a running application and saves it as a .heapsnapshot file.\n' +
      'The resulting file can be loaded in Chrome DevTools (Memory tab) for analysis.\n\n' +
      'Examples:\n' +
      '  wattpm heap-snapshot my-app                              # Take heap snapshot of my-app\n' +
      '  wattpm heap-snapshot --dir=/tmp/snapshots my-app         # Save to specific directory\n' +
      '  wattpm heap-snapshot                                     # Snapshot all applications'
  }
}
