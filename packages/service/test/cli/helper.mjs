import { Agent, setGlobalDispatcher } from 'undici'
import { on } from 'events'
import { execa } from 'execa'
import split from 'split2'
import { join } from 'desm'
import tap from 'tap'
import os from 'node:os'

setGlobalDispatcher(new Agent({
  keepAliveTimeout: 10,
  keepAliveMaxTimeout: 10,
  tls: {
    rejectUnauthorized: false
  }
}))

// This should not be needed, but a weird combination
// of node-tap, Windows, c8 and ESM makes this necessary.
tap.teardown(() => {
  process.exit(0)
})

export const cliPath = join(import.meta.url, '..', '..', 'service.mjs')

export async function start (commandOpts, exacaOpts = {}) {
  const child = execa('node', [cliPath, 'start', ...commandOpts], exacaOpts)
  child.stderr.pipe(process.stdout)

  const output = child.stdout.pipe(split(function (line) {
    try {
      const obj = JSON.parse(line)
      return obj
    } catch (err) {
      console.log(line)
    }
  }))
  child.ndj = output

  const errorTimeout = setTimeout(() => {
    throw new Error('Couldn\'t start server')
  }, 30000)

  for await (const messages of on(output, 'data')) {
    for (const message of messages) {
      const text = message.msg
      if (text && text.includes('Server listening at')) {
        const url = text.match(/Server listening at (.*)/)[1]
        clearTimeout(errorTimeout)
        return { child, url, output }
      }
    }
  }
}

export async function safeKill (child) {
  child.kill('SIGINT')
  if (os.platform() === 'win32') {
    try {
      await execa('taskkill', ['/pid', child.pid, '/f', '/t'])
    } catch (err) {
      if (err.stderr.indexOf('not found') === 0) {
        console.error(`Failed to kill process ${child.pid}`)
        console.error(err)
      }
    }
  }
}
