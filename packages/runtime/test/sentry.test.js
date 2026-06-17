import { ok } from 'node:assert'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { execRuntime, requestAndDump, stdioOutputToLogs } from './helpers.js'

async function waitFor (condition, timeout = 10_000) {
  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    if (condition()) {
      return
    }

    await sleep(100)
  }

  throw new Error('Timed out waiting for condition')
}

function parseSentryEnvelope (body, messages) {
  for (const line of body.split('\n')) {
    if (line.length === 0) {
      continue
    }

    try {
      const event = JSON.parse(line)

      if (
        typeof event.message === 'string' &&
        event.message.startsWith('sentry fixture ')
      ) {
        messages.add(event.message)
      }
    } catch {}
  }
}

test('logs all levels from the sentry fixture', async (t) => {
  const configPath = join(
    import.meta.dirname,
    '..',
    'fixtures',
    'sentry',
    'platformatic.json'
  )
  const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal']
  const stdoutMessages = new Set()
  const sentryMessages = new Set()
  const sentryServer = createServer((req, res) => {
    let body = ''

    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      parseSentryEnvelope(body, sentryMessages)
      res.writeHead(200)
      res.end('{}')
    })
  })

  await new Promise((resolve) => {
    sentryServer.listen(0, '127.0.0.1', resolve)
  })

  t.after(() => {
    sentryServer.close()
  })

  const sentryPort = sentryServer.address().port

  const { stdout } = await execRuntime({
    configPath,
    env: {
      PLT_SENTRY_DSN:
        'https://6a813b9a052def0ddfab5cad7a08f0c0@o4511575430856704.ingest.de.sentry.io/4511575432495184',
      // PLT_SENTRY_TUNNEL: `http://127.0.0.1:${sentryPort}/sentry`,
    },
    onReady: async ({ url, result }) => {
      await requestAndDump(url, { path: '/' })

      await waitFor(() => {
        const logs = stdioOutputToLogs(result.stdout)

        for (const level of levels) {
          if (
            logs.find((log) => {
              return (
                log.msg === `sentry fixture ${level} log` &&
                log.method === 'GET' &&
                log.url === '/'
              )
            })
          ) {
            stdoutMessages.add(level)
          }
        }
        return (
          stdoutMessages.size === levels.length &&
          sentryMessages.size === levels.length
        )
      })
    },
  })
  const logs = stdioOutputToLogs(stdout)

  for (const level of levels) {
    ok(
      logs.find((log) => {
        return (
          log.msg === `sentry fixture ${level} log` &&
          log.method === 'GET' &&
          log.url === '/'
        )
      }),
      `should log ${level}`
    )

    ok(
      sentryMessages.has(`sentry fixture ${level} log`),
      `should send ${level} to sentry`
    )
  }
})
