import { safeRemove } from '@platformatic/foundation'
import { execa } from 'execa'
import { join } from 'node:path'
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

export const cliPath = join(import.meta.dirname, '../../../wattpm/bin/cli.js')
export const startPath = join(import.meta.dirname, './start.mjs')

export async function start (...args) {
  let execaOptions = {}
  if (typeof args.at(-1) === 'object') {
    execaOptions = args.pop()
  }
  const child = execa(process.execPath, [startPath, ...args], execaOptions)
  child.catch(() => {})
  child.stderr.pipe(process.stdout)

  const { promise, resolve, reject } = Promise.withResolvers()

  let serverStarted = false
  const errorTimeout = setTimeout(() => {
    reject(new Error("Couldn't start server"))
  }, 30000)

  child.ndj = child.stdout.pipe(
    split(
      function (line) {
        try {
          const message = JSON.parse(line)

          if (process.env.PLT_TESTS_VERBOSE === 'true') {
            process._rawDebug(message)
          }

          const mo = message.msg?.match(/server listening at (.+)/i)

          if (!serverStarted && mo) {
            clearTimeout(errorTimeout)

            setTimeout(() => {
              resolve(mo[1])
            }, 1000)
          }

          return message
        } catch (err) {
          // No-op
        }
      },
      { highWaterMark: 1000 }
    )
  )

  const url = await promise
  serverStarted = true
  return { child, url }
}

export function delDir (tmpDir) {
  return async function () {
    // We give up after 10s.
    // This is because on Windows, it's very hard to delete files if the file
    // system is not collaborating.
    try {
      await safeRemove(tmpDir)
    } catch (err) {
      if (err.code !== 'EBUSY') {
        throw err
      } else {
        console.log('Could not delete directory, retrying', tmpDir)
      }
    }
  }
}

export function createCjsLoggingPlugin (text, reloaded) {
  return `\
    module.exports = async (app) => {
      if (${reloaded}) {
        app.log.info('RELOADED ' + '${text}')
      }
      app.get('/version', () => '${text}')
    }
  `
}

export function createEsmLoggingPlugin (text, reloaded) {
  return `\
    import fs from 'fs' // No node: scheme. Coverage for the loader.
    import dns from 'node:dns' // With node: scheme. Coverage for the loader.

    try {
      await import('./relative.mjs') // Relative path. Coverage for the loader.
    } catch {
      // Ignore err. File does not exist.
    }

    export default async function (app) {
      if (${reloaded}) {
        app.log.info('RELOADED ' + '${text}')
      }
      app.get('/version', () => '${text}')
    }
  `
}
