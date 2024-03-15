'use strict'

const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { createReadStream, watch } = require('node:fs')
const { readdir, rm } = require('node:fs/promises')
const ts = require('tail-file-stream')

const LOGS_FILES_LIMIT = 30 // 30 files * 5MB = 150MB
const LOGS_FILES_THRESHOLD = LOGS_FILES_LIMIT + 10

const PLATFORMATIC_TMP_DIR = join(tmpdir(), 'platformatic', 'runtimes')
const runtimeTmpDir = join(PLATFORMATIC_TMP_DIR, process.pid.toString())

async function getLogFiles () {
  const runtimeTmpFiles = await readdir(runtimeTmpDir)
  const runtimeLogFiles = runtimeTmpFiles
    .filter((file) => file.startsWith('logs'))
    .sort((log1, log2) => {
      const index1 = parseInt(log1.slice('logs.'.length))
      const index2 = parseInt(log2.slice('logs.'.length))
      return index1 - index2
    })
  return runtimeLogFiles
}

async function pipeLiveLogs (writableStream, logger, startLogIndex) {
  const runtimeLogFiles = await getLogFiles()
  if (runtimeLogFiles.length === 0) {
    writableStream.end()
    return
  }

  let latestFileIndex = parseInt(runtimeLogFiles.at(-1).slice('logs.'.length))

  let waiting = false
  let fileStream = null
  let fileIndex = startLogIndex ?? latestFileIndex

  const watcher = watch(runtimeTmpDir, async (event, filename) => {
    if (event === 'rename' && filename.startsWith('logs')) {
      const logFileIndex = parseInt(filename.slice('logs.'.length))
      if (logFileIndex > latestFileIndex) {
        latestFileIndex = logFileIndex
        if (waiting) {
          streamLogFile(++fileIndex)
        }
      }
    }
  }).unref()

  const streamLogFile = () => {
    const fileName = 'logs.' + fileIndex
    const filePath = join(runtimeTmpDir, fileName)

    const prevFileStream = fileStream

    fileStream = ts.createReadStream(filePath)
    fileStream.pipe(writableStream, { end: false })

    if (prevFileStream) {
      prevFileStream.unpipe(writableStream)
      prevFileStream.destroy()
    }

    fileStream.on('error', (err) => {
      logger.log.error(err, 'Error streaming log file')
      fileStream.destroy()
      watcher.close()
      writableStream.end()
    })

    fileStream.on('data', () => {
      waiting = false
    })

    fileStream.on('eof', () => {
      if (latestFileIndex > fileIndex) {
        streamLogFile(++fileIndex)
      } else {
        waiting = true
      }
    })

    return fileStream
  }

  streamLogFile(fileIndex)

  writableStream.on('close', () => {
    watcher.close()
    fileStream.destroy()
  })
  writableStream.on('error', () => {
    watcher.close()
    fileStream.destroy()
  })
}

async function getLogIndexes () {
  const runtimeLogFiles = await getLogFiles()
  let runtimeLogsIndexes = runtimeLogFiles
    .map((file) => parseInt(file.slice('logs.'.length)))

  if (runtimeLogsIndexes.length > LOGS_FILES_LIMIT) {
    runtimeLogsIndexes = runtimeLogsIndexes.slice(-LOGS_FILES_LIMIT)
  }

  return runtimeLogsIndexes
}

async function getLogFileStream (logFileIndex) {
  const filePath = join(runtimeTmpDir, `logs.${logFileIndex}`)
  return createReadStream(filePath)
}

async function cleanLogs () {
  const runtimeLogFiles = await getLogFiles()
  if (runtimeLogFiles.length > LOGS_FILES_THRESHOLD) {
    const removePromises = runtimeLogFiles
      .slice(0, runtimeLogFiles.length - LOGS_FILES_LIMIT)
      .map((file) => join(runtimeTmpDir, file))
      .map((filePath) => rm(filePath))

    await Promise.allSettled(removePromises)
  }
}

function startCleanLogsWatcher () {
  watch(runtimeTmpDir, async (event, filename) => {
    if (event === 'rename' && filename.startsWith('logs')) {
      const logFileIndex = parseInt(filename.slice('logs.'.length))
      if (logFileIndex % LOGS_FILES_THRESHOLD === 0) {
        cleanLogs()
      }
    }
  }).unref()
}

module.exports = {
  pipeLiveLogs,
  getLogFileStream,
  getLogIndexes,
  startCleanLogsWatcher
}
