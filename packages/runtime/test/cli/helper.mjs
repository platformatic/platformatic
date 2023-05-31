import { on } from 'node:events'
import { Agent, setGlobalDispatcher } from 'undici'
import { execa } from 'execa'
import split from 'split2'
import { join } from 'desm'

setGlobalDispatcher(new Agent({
  keepAliveTimeout: 10,
  keepAliveMaxTimeout: 10,
  tls: {
    rejectUnauthorized: false
  }
}))

export const cliPath = join(import.meta.url, '..', '..', 'runtime.mjs')

export async function start (...args) {
  const child = execa(process.execPath, [cliPath, 'start', ...args])
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
      const url = message.url ??
        message.msg.match(/server listening at (.+)/i)?.[1]

      if (url !== undefined) {
        clearTimeout(errorTimeout)
        return { child, url, output }
      }
    }
  }
}
