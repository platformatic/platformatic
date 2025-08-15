'use strict'

const { readFile, writeFile } = require('node:fs/promises')
const { join, resolve } = require('node:path')
const { setTimeout: sleep } = require('node:timers/promises')
const { createDirectory, safeRemove } = require('@platformatic/foundation')
const { transform, create } = require('../index.js')

const LOGS_TIMEOUT = process.env.CI ? 5000 : 1000
let tempDirCounter = 0
const tempPath = resolve(__dirname, '../../../tmp/')

async function getTempDir () {
  const dir = join(tempPath, `runtime-${process.pid}-${Date.now()}-${tempDirCounter++}`)
  await createDirectory(dir, true)
  return dir
}

async function moveToTmpdir (teardown) {
  const cwd = process.cwd()
  const dir = await getTempDir()
  process.chdir(dir)
  teardown(() => process.chdir(cwd))
  if (!process.env.SKIP_RM_TMP) {
    teardown(() => safeRemove(dir))
  }
  return dir
}

async function updateFile (path, update) {
  const contents = await readFile(path, 'utf-8')
  await writeFile(path, await update(contents), 'utf-8')
}

async function updateConfigFile (path, update) {
  const contents = JSON.parse(await readFile(path, 'utf-8'))
  await update(contents)
  await writeFile(path, JSON.stringify(contents, null, 2), 'utf-8')
}

async function readLogs (path, delay = LOGS_TIMEOUT, raw = false) {
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

async function createRuntime (configOrRoot, sourceOrConfig, context) {
  await createDirectory(tempPath)

  const originalTransform = context?.transform ?? transform
  context ??= {}
  context.logsPath = resolve(tempPath, `log-${Date.now()}.txt`)

  return create(configOrRoot, sourceOrConfig, {
    ...context,
    async transform (config, ...args) {
      config = await originalTransform(config, ...args)

      config.logger ??= {}
      config.logger.transport ??= {
        target: 'pino/file',
        options: { destination: context.logsPath }
      }

      return config
    }
  })
}

module.exports = {
  LOGS_TIMEOUT,
  moveToTmpdir,
  updateFile,
  updateConfigFile,
  readLogs,
  getTempDir,
  createRuntime
}
