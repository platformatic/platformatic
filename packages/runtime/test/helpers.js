'use strict'

const { on } = require('node:events')
const { readFile, writeFile } = require('node:fs/promises')
const { platform } = require('node:os')
const { join } = require('node:path')
const { createDirectory } = require('@platformatic/utils')
const { safeRemove } = require('@platformatic/utils')
const { link } = require('fs/promises')
const WebSocket = require('ws')

let counter = 0
async function getTempDir (baseDir) {
  if (baseDir === undefined) {
    baseDir = __dirname
  }
  const dir = join(baseDir, 'tmp', `plt-runtime-${process.pid}-${Date.now()}-${counter++}`)
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

async function linkNodeModules (dir, pkgs) {
  await createDirectory(join(dir, 'node_modules'))
  for (const pkg of pkgs) {
    if (pkg.startsWith('@')) {
      const [scope, name] = pkg.split('/')
      await createDirectory(join(dir, 'node_modules', scope))
      await link(join(__dirname, '..', 'node_modules', scope, name), join(dir, 'node_modules', scope, name))
    } else {
      await link(join(__dirname, '..', 'node_modules', pkg), join(dir, 'node_modules', pkg))
    }
  }
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

async function openLogsWebsocket (app) {
  const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
  const managementApiWebsocket = new WebSocket(protocol + app.getManagementApiUrl() + ':/api/v1/logs/live')

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout'))
    }, 3000)

    managementApiWebsocket.on('error', reject)

    if (process.env.PLT_TESTS_VERBOSE === 'true') {
      managementApiWebsocket.on('message', msg => {
        for (const line of msg.toString().trim().split('\n')) {
          process._rawDebug(line)
        }
      })
    }

    managementApiWebsocket.on('open', () => {
      clearTimeout(timeout)
      managementApiWebsocket.off('error', reject)
      resolve()
    })
  })

  return managementApiWebsocket
}

async function waitForLogs (socket, ...exprs) {
  const toMatch = new Set(exprs)
  const messages = []

  for await (const [msg] of on(socket, 'message')) {
    for (const line of msg.toString().trim().split('\n')) {
      let message
      try {
        message = JSON.parse(line)
        messages.push(message)
      } catch (e) {
        console.error('Ignoring an non JSON line coming from WebSocket: ', line)
        continue
      }

      for (const expr of toMatch) {
        const matches = typeof expr === 'string' ? message.msg?.startsWith(expr) : message.msg?.match(expr)

        if (matches) {
          toMatch.delete(expr)

          if (toMatch.size === 0) {
            return messages
          }
        }
      }
    }
  }
}

module.exports = {
  getTempDir,
  moveToTmpdir,
  linkNodeModules,
  updateFile,
  updateConfigFile,
  openLogsWebsocket,
  waitForLogs
}
