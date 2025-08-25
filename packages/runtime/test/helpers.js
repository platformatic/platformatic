import { createDirectory, safeRemove } from '@platformatic/foundation'
import { readFile, writeFile } from 'node:fs/promises'
import { platform } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { create, transform } from '../index.js'

export const isWindows = platform() === 'win32'
export const isCIOnWindows = process.env.CI && isWindows
export const LOGS_TIMEOUT = process.env.CI ? 5000 : 1000

let tempDirCounter = 0
const tempPath = resolve(import.meta.dirname, '../../../tmp/')

export async function getTempDir () {
  const dir = join(tempPath, `runtime-${process.pid}-${Date.now()}-${tempDirCounter++}`)
  await createDirectory(dir, true)
  return dir
}

export async function moveToTmpdir (teardown) {
  const cwd = process.cwd()
  const dir = await getTempDir()
  process.chdir(dir)
  teardown(() => process.chdir(cwd))
  if (!process.env.PLT_TESTS_SKIP_REMOVE_TEMPORARY) {
    teardown(() => safeRemove(dir))
  }
  return dir
}

export async function updateFile (path, update) {
  const contents = await readFile(path, 'utf-8')
  await writeFile(path, await update(contents), 'utf-8')
}

export async function updateConfigFile (path, update) {
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

export async function createRuntime (configOrRoot, sourceOrConfig, context) {
  await createDirectory(tempPath)

  const originalTransform = context?.transform ?? transform
  context ??= {}
  context.logsPath = resolve(tempPath, `log-${Date.now()}.txt`)

  return create(configOrRoot, sourceOrConfig, {
    ...context,
    async transform (config, ...args) {
      config = await originalTransform(config, ...args)

      config.logger ??= {}

      if (process.env.PLT_TESTS_VERBOSE !== 'true') {
        config.logger.transport ??= {
          target: 'pino/file',
          options: { destination: context.logsPath }
        }
      } else {
        config.logger.level = 'trace'
      }

      return config
    }
  })
}
