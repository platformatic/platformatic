import { createDirectory, safeRemove } from '@platformatic/foundation'
import { execa } from 'execa'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { platform } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import { request } from 'undici'
import { create, transform } from '../index.js'

export { setTimeout as sleep, setImmediate as sleepImmediate } from 'node:timers/promises'

export const isWindows = platform() === 'win32'
export const isCIOnWindows = process.env.CI && isWindows
export const LOGS_TIMEOUT = process.env.CI ? 5000 : 1000

let tempDirCounter = 0

export const tempPath = resolve(import.meta.dirname, '../../../tmp/')
export const startPath = join(import.meta.dirname, 'cli/start.js')

export async function getTempDir () {
  const dir = join(tempPath, `runtime-${process.pid}-${Date.now()}-${tempDirCounter++}`)
  await createDirectory(dir, true)
  return dir
}

export async function createTemporaryDirectory (t, prefix) {
  const directory = join(tempPath, `plt-${prefix}-${process.pid}-${tempDirCounter++}`)

  t.after(async () => {
    if (process.env.PLT_TESTS_KEEP_TMP !== 'true') {
      return safeRemove(directory)
    } else {
      process._rawDebug(`Keeping temporary folder: ${directory}`)
    }
  })

  await createDirectory(directory)
  return directory
}

export async function moveToTmpdir (teardown) {
  const cwd = process.cwd()
  const dir = await getTempDir()
  process.chdir(dir)
  teardown(() => process.chdir(cwd))
  if (process.env.PLT_TESTS_DEBUG !== 'true') {
    teardown(() => safeRemove(dir))
  }
  return dir
}

/*
  The configuration file a directory actually holds. Tests used to name it, which was safe while
  every project spelled it the same way; a converted project spells it watt.config.js or
  watt.config.mjs depending on what its nearest package.json says about modules, so asking the
  directory is the only spelling that keeps working.
*/
export function configurationFileIn (directory) {
  for (const candidate of ['watt.config.js', 'watt.config.mjs', 'watt.config.ts', 'watt.config.mts']) {
    const path = join(directory, candidate)

    if (existsSync(path)) {
      return path
    }
  }

  // A directory with no v4 configuration is still a legitimate answer for the v3 fixtures that
  // remain -- the caller gets the name it would have used.
  return configurationFileIn(directory)
}

export async function updateFile (path, update) {
  const contents = await readFile(path, 'utf-8')
  await writeFile(path, await update(contents), 'utf-8')

  return {
    revert () {
      return writeFile(path, contents, 'utf-8')
    }
  }
}

/*
  A test naming a v3 configuration file in a directory that now holds a v4 one is asking to update
  that directory's configuration, not to create the file it named. Resolving it here keeps the
  callers -- which say platformatic.application.json in a good many places -- from having to know
  which dialect the fixture they were handed is written in.
*/
function resolveConfigurationPath (path) {
  if (existsSync(path)) {
    return path
  }

  const directory = dirname(path)

  for (const candidate of ['watt.config.js', 'watt.config.mjs', 'watt.config.ts', 'watt.config.mts']) {
    const resolved = join(directory, candidate)

    if (existsSync(resolved)) {
      return resolved
    }
  }

  return path
}

export async function updateConfigFile (originalPath, update) {
  const path = resolveConfigurationPath(originalPath)

  /*
    A v4 configuration is code, so it is imported rather than parsed. The cache-busting query is
    what makes a second update in the same process see the first one's result.

    Writing it back as a literal loses any expression the file contained — a process.env read
    becomes whatever it evaluated to. That is acceptable for a fixture a test is deliberately
    rewriting, and wrong for anything else, which is why this lives in the test helpers.
  */
  if (/\.(js|mjs|ts|mts)$/.test(path)) {
    const { default: contents } = await import(`${pathToFileURL(path).href}?update=${randomUUID()}`)

    await update(contents)
    await writeFile(path, `export default ${JSON.stringify(contents, null, 2)}\n`, 'utf-8')
    return
  }

  const contents = JSON.parse(await readFile(path, 'utf-8'))
  await update(contents)
  await writeFile(path, JSON.stringify(contents, null, 2), 'utf-8')
}

export async function readLogs (path, delay = LOGS_TIMEOUT, raw = false) {
  if (typeof delay !== 'number') {
    delay = LOGS_TIMEOUT
  }

  if (delay > 0) {
    await sleep(delay)
  }

  const contents = await readFile(path, 'utf-8')

  if (raw) {
    return contents
  }

  return contents
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => {
      try {
        return JSON.parse(line)
      } catch (err) {
        return { __raw: line }
      }
    })
}

export function stdioOutputToLogs (data) {
  const logs = data
    .map(line => {
      try {
        return JSON.parse(line)
      } catch {
        return line
          .trim()
          .split('\n')
          .map(l => {
            try {
              return JSON.parse(l)
            } catch {}
            return null
          })
          .filter(log => log)
      }
    })
    .filter(log => log)

  return logs.flat()
}

export async function requestAndDump (url, opts) {
  try {
    const { body } = await request(url, opts)
    await body.text()
  } catch {}
}

export function execRuntime ({ configPath, onReady, done, timeout = 30_000, env = {} }) {
  return new Promise((resolve, reject) => {
    if (!done && !onReady) {
      reject(new Error('done or onReady fn is required'))
      return
    }

    const result = {
      stdout: [],
      stderr: [],
      url: null
    }
    let ready = false
    let teardownCalled = false

    async function teardown () {
      if (teardownCalled) {
        return
      }
      teardownCalled = true

      timeoutId && clearTimeout(timeoutId)

      if (!child) {
        return
      }
      child.kill('SIGKILL')
      child.catch(() => {})
      child = null
    }

    let child = execa(process.execPath, [startPath, configPath], {
      encoding: 'utf8',
      env: { PLT_USE_PLAIN_CREATE: true, ...env }
    })

    const timeoutId = setTimeout(async () => {
      clearTimeout(timeoutId)

      await teardown()
      reject(new Error('Timeout'))
    }, timeout)

    const verbose = process.env.PLT_TESTS_VERBOSE === 'true'

    child.stdout.on('data', message => {
      if (verbose) {
        process._rawDebug(message.toString())
      }

      const m = message.toString()
      result.stdout.push(m)

      if (done?.(m)) {
        teardown().then(() => {
          resolve(result)
        })
        return
      }

      if (ready) {
        return
      }

      const match = m.match(/Platformatic is now listening at (http:\/\/(?:127\.0\.0\.1|\[::1\]):\d+)/)
      if (match) {
        result.url = match[1]
        Promise.resolve(onReady?.({ url: result.url, result })).then(() => {
          if (!done) {
            teardown().then(() => {
              resolve(result)
            })
          }
        }, err => {
          teardown().then(() => {
            reject(new Error('Error calling onReady', { cause: err }))
          })
        })
        ready = true
      }
    })

    child.stderr.on('data', message => {
      if (verbose) {
        process._rawDebug(message.toString())
      }

      result.stderr.push(message.toString())
    })
  })
}

export async function createRuntime (configOrRoot, sourceOrConfig, context) {
  await createDirectory(tempPath)

  const originalTransform = context?.transform ?? transform
  context ??= {}
  context.logsPath ??= resolve(tempPath, `log-${Date.now()}.txt`)

  return create(configOrRoot, sourceOrConfig, {
    ...context,
    async transform (config, ...args) {
      config = await originalTransform(config, ...args)
      config.logger ??= {}

      const debug = process.env.PLT_TESTS_DEBUG === 'true'
      const verbose = process.env.PLT_TESTS_VERBOSE === 'true'

      if (verbose) {
        config.logger.level = debug ? 'trace' : 'info'
      } else {
        if (debug) {
          config.logger.level = 'trace'
          process._rawDebug('Runtime logs:', context.logsPath)
        }

        config.logger.transport ??= {
          target: 'pino/file',
          options: { destination: context.logsPath }
        }
      }

      return config
    }
  })
}
