'use strict'

const { readFile, writeFile } = require('node:fs/promises')
const { join, resolve, dirname } = require('node:path')
const { setTimeout: sleep } = require('node:timers/promises')
const { createDirectory, safeRemove } = require('@platformatic/utils')

let tempDirCounter = 0

async function getTempDir (baseDir) {
  if (baseDir === undefined) {
    baseDir = __dirname
  }
  const dir = join(baseDir, 'tmp', `plt-runtime-${process.pid}-${Date.now()}-${tempDirCounter++}`)
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

async function setLogFile (t) {
  const originalEnv = process.env.PLT_RUNTIME_LOGGER_STDOUT
  const logFile = resolve(__dirname, `../../../tmp/log-${Date.now()}.txt`)
  process.env.PLT_RUNTIME_LOGGER_STDOUT = logFile

  await createDirectory(dirname(logFile))

  t.after(async () => {
    process.env.PLT_RUNTIME_LOGGER_STDOUT = originalEnv
    return safeRemove(logFile)
  })
}

async function readLogs (delay) {
  if (typeof delay !== 'number') {
    delay = process.env.CI ? 10000 : 5000
  }

  if (delay > 0) {
    await sleep(delay)
  }

  const contents = await readFile(process.env.PLT_RUNTIME_LOGGER_STDOUT, 'utf-8')

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

module.exports = {
  moveToTmpdir,
  updateFile,
  updateConfigFile,
  setLogFile,
  readLogs
}
