// import why from 'why-is-node-running'
import { Agent, setGlobalDispatcher } from 'undici'
import { on } from 'events'
import { execa } from 'execa'
import split from 'split2'
import { join } from 'desm'
import tap from 'tap'

// This file must be required/imported as the first file
// in the test suite. It sets up the global environment
// to track the open handles via why-is-node-running.
// setInterval(() => {
//  why()
// }, 20000).unref()

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

export async function start (...args) {
  const child = execa('node', [cliPath, 'start', ...args])
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
      const url = message.url
      if (url !== undefined) {
        clearTimeout(errorTimeout)
        return { child, url, output }
      }
    }
  }
}
