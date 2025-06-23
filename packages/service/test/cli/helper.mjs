import { join } from 'desm'
import { on } from 'events'
import { execa } from 'execa'
import os from 'node:os'
import split from 'split2'
import { Agent, setGlobalDispatcher } from 'undici'

setGlobalDispatcher(
  new Agent({
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10,
    tls: {
      rejectUnauthorized: false
    }
  })
)

export const cliPath = join(import.meta.url, '..', '..', 'bin', 'plt-service.mjs')
export const startPath = join(import.meta.url, './start.mjs')

export async function start (commandOpts, exacaOpts = {}) {
  const child = execa('node', [startPath, ...commandOpts], exacaOpts)
  child.stderr.pipe(process.stdout)

  const output = child.stdout.pipe(
    split(function (line) {
      try {
        const obj = JSON.parse(line)
        return obj
      } catch (err) {
        console.log(line)
      }
    })
  )
  child.ndj = output

  const errorTimeout = setTimeout(() => {
    throw new Error("Couldn't start server")
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
  child.catch(() => {})
  child.kill('SIGINT')
  if (os.platform() === 'win32') {
    try {
      await execa('wmic', ['process', 'where', `ParentProcessId=${child.pid}`, 'delete'])
      await execa('wmic', ['process', 'where', `ProcessId=${child.pid}`, 'delete'])
    } catch (err) {
      if (err.stderr.indexOf('not found') === 0) {
        console.error(`Failed to kill process ${child.pid}`)
        console.error(err)
      }
    }
  }
}
