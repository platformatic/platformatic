import { getMatchingRuntime, RuntimeApiClient } from '@platformatic/control'
import { ensureLoggableError, logFatalError, parseArgs } from '@platformatic/foundation'
import { bold } from 'colorette'
import { getBorderCharacters, table } from 'table'

const tableConfig = {
  /* c8 ignore next */
  border: getBorderCharacters(process.stdout.isTTY ? 'norc' : 'ramac'),
  drawHorizontalLine (index, rowCount) {
    return index < 2 || index === rowCount
  }
}

async function updateSchedulerCommand (logger, args, action, socket) {
  const { positionals: allPositionals } = parseArgs(args, {}, false)
  const client = new RuntimeApiClient({ logger, socket })

  try {
    const [runtime, positionals] = await getMatchingRuntime(client, allPositionals)
    const name = positionals[0]
    if (!name) {
      return logFatalError(logger, `A scheduler job name is required to ${action} a job.`)
    }

    const result = await client[`${action}RuntimeSchedulerJob`](runtime.pid, name)
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    if (error.code === 'PLT_CTR_RUNTIME_NOT_FOUND') {
      return logFatalError(logger, 'Cannot find a matching runtime.')
    }

    return logFatalError(
      logger,
      { error: ensureLoggableError(error) },
      `Cannot ${action} scheduler job: ${error.message}`
    )
  } finally {
    await client.close()
  }
}

export async function schedulerCommand (logger, args) {
  const { positionals } = parseArgs(args, {}, false)
  const client = new RuntimeApiClient({ logger, socket: this.socket })

  try {
    const [runtime] = await getMatchingRuntime(client, positionals)
    const { jobs } = await client.getRuntimeSchedulerJobs(runtime.pid)
    const rows = jobs.map(job => [
      job.name,
      job.cron,
      job.source,
      job.paused ? 'Yes' : 'No',
      job.nextRunAt ?? '-'
    ])

    console.log(
      '\n' + table([[bold('Name'), bold('Cron'), bold('Source'), bold('Paused'), bold('Next run')], ...rows], tableConfig)
    )
  } catch (error) {
    if (error.code === 'PLT_CTR_RUNTIME_NOT_FOUND') {
      return logFatalError(logger, 'Cannot find a matching runtime.')
    }

    return logFatalError(
      logger,
      { error: ensureLoggableError(error) },
      `Cannot list scheduler jobs: ${error.message}`
    )
  } finally {
    await client.close()
  }
}

export function schedulerPauseCommand (logger, args) {
  return updateSchedulerCommand(logger, args, 'pause', this.socket)
}

export function schedulerResumeCommand (logger, args) {
  return updateSchedulerCommand(logger, args, 'resume', this.socket)
}

export function schedulerRunCommand (logger, args) {
  return updateSchedulerCommand(logger, args, 'run', this.socket)
}

export const help = {
  scheduler: {
    usage: 'scheduler [id]',
    description: 'Lists scheduler jobs',
    args: [{ name: 'id', description: 'The process ID or the name of the runtime' }]
  },
  'scheduler:pause': {
    usage: 'scheduler:pause [id] <name>',
    description: 'Pauses a scheduler job',
    args: [
      { name: 'id', description: 'The process ID or the name of the runtime' },
      { name: 'name', description: 'The scheduler job name' }
    ]
  },
  'scheduler:resume': {
    usage: 'scheduler:resume [id] <name>',
    description: 'Resumes a scheduler job',
    args: [
      { name: 'id', description: 'The process ID or the name of the runtime' },
      { name: 'name', description: 'The scheduler job name' }
    ]
  },
  'scheduler:run': {
    usage: 'scheduler:run [id] <name>',
    description: 'Runs a scheduler job immediately',
    args: [
      { name: 'id', description: 'The process ID or the name of the runtime' },
      { name: 'name', description: 'The scheduler job name' }
    ]
  }
}
