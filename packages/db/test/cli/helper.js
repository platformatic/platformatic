import { createConnectionPool } from '@platformatic/sql-mapper'
import { on } from 'node:events'
import os from 'node:os'
import { join, resolve } from 'node:path'
import split from 'split2'
import { Agent, setGlobalDispatcher } from 'undici'
import why from 'why-is-node-running'

// This file must be required/imported as the first file
// in the test suite. It sets up the global environment
// to track the open handles via why-is-node-running.
if (process.env.WHY === 'true') {
  setInterval(() => {
    why()
  }, 60000).unref()
}

setGlobalDispatcher(
  new Agent({
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10,
    tls: {
      rejectUnauthorized: false
    }
  })
)

// Inline start executable implementation for tests that need subprocess execution
export const startPath = resolve(import.meta.dirname, './start-executable.js')

export async function connectDB (connectionInfo) {
  const { db } = await createConnectionPool({
    log: {
      debug: () => {},
      info: () => {},
      trace: () => {},
      error: () => {}
    },
    max: 1,
    ...connectionInfo
  })
  return db
}

export function removeFileProtocol (str) {
  return str.replace('file:', '')
}

export function getFixturesConfigFileLocation (filename, subdirectories = []) {
  return removeFileProtocol(join(import.meta.dirname, '..', 'fixtures', ...subdirectories, filename))
}

export async function start (commandOpts, exacaOpts = {}) {
  const { execa } = await import('execa')
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
  }, 10000)

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

export function parseEnv (envFile) {
  const env = {}
  for (const line of envFile.split('\n')) {
    if (line) {
      const [key, value] = line.split('=')
      env[key.trim()] = value.trim()
    }
  }
  return env
}

export async function safeKill (child, signal = 'SIGINT') {
  const { execa } = await import('execa')
  child.catch(() => {})
  child.kill(signal)
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
