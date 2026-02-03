import { getMatchingRuntime, RuntimeApiClient } from '@platformatic/control'
import { ensureLoggableError, logFatalError, parseArgs } from '@platformatic/foundation'
import { bold } from 'colorette'
import { createInterface } from 'node:readline'
import { getBorderCharacters, table } from 'table'
import { getSocket } from '../utils.js'

const tableConfig = {
  /* c8 ignore next */
  border: getBorderCharacters(process.stdout.isTTY ? 'norc' : 'ramac'),
  drawHorizontalLine (index, rowCount) {
    return index < 2 || index === rowCount
  }
}

export async function replCommand (logger, args) {
  const { positionals: allPositionals } = parseArgs(args, {}, false)

  const client = new RuntimeApiClient({ logger, socket: getSocket() })
  try {
    const [runtime, positionals] = await getMatchingRuntime(client, allPositionals)
    let application = positionals[0]

    if (!application) {
      const { applications } = await client.getRuntimeApplications(runtime.pid)

      if (applications.length === 1) {
        // Auto-connect if there's only one application
        application = applications[0].id
      } else {
        // List available applications when there are multiple
        console.log('\nAvailable applications:')
        const rows = applications.map(app => {
          const { id, type, entrypoint } = app
          return [id, type, entrypoint ? 'Yes' : 'No']
        })
        console.log(table([[bold('Name'), bold('Type'), bold('Entrypoint')], ...rows], tableConfig))
        console.log('Usage: wattpm repl <application-name>\n')
        await client.close()
        return
      }
    }

    const ws = client.getRuntimeApplicationRepl(runtime.pid, application)

    await new Promise((resolve, reject) => {
      ws.on('open', resolve)
      ws.on('error', reject)
    })

    // Set up readline for stdin
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: process.stdin.isTTY
    })

    // Forward stdin to WebSocket
    rl.on('line', line => {
      ws.send(line + '\n')
    })

    // Handle Ctrl+D (EOF)
    rl.on('close', () => {
      ws.close()
      client.close()
      process.exit(0)
    })

    // Forward WebSocket output to stdout
    ws.on('message', data => {
      process.stdout.write(data.toString())
    })

    // Handle cleanup
    function onClose () {
      rl.close()
      ws.close()
      client.close()
      process.exit(0)
    }

    process.on('SIGINT', onClose)
    process.on('SIGTERM', onClose)

    ws.on('close', () => {
      rl.close()
      client.close()
      process.exit(0)
    })

    ws.on('error', error => {
      logger.error({ error: ensureLoggableError(error) }, 'WebSocket error')
      rl.close()
      client.close()
      process.exit(1)
    })
  } catch (error) {
    if (error.code === 'PLT_CTR_RUNTIME_NOT_FOUND') {
      return logFatalError(logger, 'Cannot find a matching runtime.')
    } else if (error.code === 'PLT_CTR_APPLICATION_NOT_FOUND') {
      return logFatalError(logger, 'Cannot find a matching application.')
    } else {
      return logFatalError(logger, { error: ensureLoggableError(error) }, `Cannot start REPL: ${error.message}`)
    }
  }
}

export const help = {
  repl: {
    usage: 'repl [id] <application>',
    description: 'Starts a REPL session inside a running application',
    args: [
      {
        name: 'id',
        description:
          'The process ID or the name of the runtime (it can be omitted only if there is a single runtime running)'
      },
      {
        name: 'application',
        description:
          'The application name (if omitted, auto-connects when single application or lists available applications)'
      }
    ],
    footer: `
The REPL session runs inside the worker thread of the specified application.
You have access to:
  - app: The Fastify application instance (for service-based apps)
  - capability: The application capability object with configuration and methods
  - platformatic: The global platformatic object
  - config: The application configuration
  - logger: The application logger

Press Ctrl+C, Ctrl+D, or type .exit to exit the REPL.
    `
  }
}
