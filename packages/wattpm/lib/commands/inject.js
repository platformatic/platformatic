import { RuntimeApiClient } from '@platformatic/control'
import { ensureLoggableError } from '@platformatic/utils'
import { createWriteStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { finished } from 'node:stream/promises'
import { setTimeout as sleep } from 'node:timers/promises'
import { getMatchingRuntimeArgs, parseArgs, verbose } from '../utils.js'

async function getRequest (client, runtime, positionals) {
  /*
      There are several ways to invoke this command:

        1. wattpm inject $SERVICE $METHOD $URL
        2. wattpm inject $SERVICE $URL
        3. wattpm inject $METHOD
        4. wattpm inject $URL
    */
  let service
  let method
  let url

  // TODO@ShogunPanda: Make id also optional
  if (positionals.length === 3) {
    service = positionals[0]
    method = positionals[1]
    url = positionals[2]
  } else if (positionals.length === 2) {
    const servicesInfo = await client.getRuntimeServices(runtime.pid)
    const services = servicesInfo.services.map(s => s.id)

    // If the first argument is a valid service, we use it
    if (services.includes(positionals[0])) {
      service = positionals[0]
      method = 'GET'
      url = positionals[1]
    } else {
      service = servicesInfo.entrypoint
      method = positionals[0]
      url = positionals[1]
    }
  } else {
    method = 'GET'
    url = positionals[1] ?? '/'
  }

  return { service, method, url }
}

function appendOutput (logger, stream, fullOutput, line) {
  if (verbose) {
    logger.info(line)
  }

  if (fullOutput) {
    stream.write(line + '\n')
  }
}

export async function injectCommand (logger, args) {
  const {
    values: { header: rawHeaders, data, 'data-file': file, output, 'full-output': fullOutput },
    positionals
  } = parseArgs(
    args,
    {
      header: {
        type: 'string',
        short: 'h',
        multiple: true,
        default: []
      },
      data: {
        type: 'string',
        short: 'd'
      },
      'data-file': {
        type: 'string',
        short: 'D'
      },
      output: {
        type: 'string',
        short: 'o'
      },
      'full-output': {
        type: 'boolean',
        short: 'f',
        default: false
      }
    },
    false
  )

  const headers = Object.fromEntries(
    rawHeaders.map(h => {
      const [k, ...value] = h.split(':')

      return [k, value.join(':')]
    })
  )

  const outputStream = output ? createWriteStream(resolve(process.cwd(), output)) : process.stdout

  try {
    const client = new RuntimeApiClient()
    const runtime = await client.getMatchingRuntime(getMatchingRuntimeArgs(logger, positionals))

    const { service, method, url } = await getRequest(client, runtime, positionals.slice(1))

    let body
    if (file) {
      body = await readFile(resolve(process.cwd(), file), 'utf-8')
    } else if (data) {
      body = data
    }

    // Track request
    appendOutput(logger, outputStream, fullOutput, `> ${method} ${url} HTTP/1.1`)

    for (const [name, value] of Object.entries(headers)) {
      appendOutput(logger, outputStream, fullOutput, `> ${name}: ${value}`)
    }

    appendOutput(logger, outputStream, fullOutput, '>')

    // Perform the request
    const response = await client.injectRuntime(runtime.pid, service, { url, method, headers, body })

    // Track response
    appendOutput(logger, outputStream, fullOutput, `< HTTP/1.1 ${response.statusCode}`)

    for (const [name, value] of Object.entries(response.headers)) {
      appendOutput(logger, outputStream, fullOutput, `< ${name}: ${value}`)
    }

    appendOutput(logger, outputStream, fullOutput, '<')

    // Show the response
    const responseBody = await response.body.text()

    if (verbose && !output) {
      await sleep(100)
    }

    if (verbose || fullOutput) {
      outputStream.write('\n')
    }
    outputStream.write(responseBody)

    if (output) {
      outputStream.end()
      await finished(outputStream)
    }

    await client.close()
  } catch (error) {
    if (error.code === 'PLT_CTR_RUNTIME_NOT_FOUND') {
      logger.fatal('Cannot find a matching runtime.')
    } else if (error.code === 'PLT_CTR_SERVICE_NOT_FOUND') {
      logger.fatal('Cannot find a matching service.')
    }

    logger.fatal({ error: ensureLoggableError(error) }, `Cannot perform a request: ${error.message}`)
  }
}

export const help = {
  inject: {
    usage: 'inject <id> [service] [method] [url]',
    description: 'Injects a request to a Platformatic application',
    footer: `
The \`inject\` command sends a request to the runtime service and prints the
response to the standard output. If the service is not specified the
request is sent to the runtime entry point.

The \`inject\` command uses the Platformatic Runtime Management API. To enable it
set the \`managementApi\` option to \`true\` in the wattpm configuration file.

To get the list of runtimes with enabled management API use the \`wattpm ps\` command.    
    `,
    options: [
      { usage: '-h, --header <value>', description: 'The request header. Can be used multiple times.' },
      { usage: '-d, --data <value>', description: 'The request body.' },
      { usage: '-D, --data-file <path>', description: 'Read the request body from the specified file' },
      { usage: '-o, --output <path>', description: 'Write the response to the specified file' },
      { usage: '-f, --full-output', description: 'Include the response headers in the output (default is false)' }
    ],
    args: [
      {
        name: 'id',
        description: 'The process ID or the name of the application'
      },
      {
        name: 'service',
        description: 'The service name (default is the entrypoint)'
      },
      {
        name: 'method',
        description: 'The HTTP method to use (default is "GET")'
      },
      {
        name: 'url',
        description: 'The URL to inject (default is "/")'
      }
    ]
  }
}
