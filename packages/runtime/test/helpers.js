'use strict'

const { on } = require('node:events')
const { readFile, writeFile } = require('node:fs/promises')
const { platform } = require('node:os')
const { join } = require('node:path')
const { createDirectory } = require('@platformatic/utils')
const { safeRemove } = require('@platformatic/utils')
const { link } = require('fs/promises')
const WebSocket = require('ws')
const { execa } = require('execa')
const { cliPath } = require('./cli/helper.mjs')

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

function stdioOutputToLogs (data) {
  const logs = data.map(line => {
    try {
      return JSON.parse(line)
    } catch {
      return line.trim().split('\n').map(l => {
        try {
          return JSON.parse(l)
        } catch { }
        return null
      }).filter(log => log)
    }
  }).filter(log => log)

  return logs.flat()
}

function execRuntime ({ configPath, onReady, done, timeout = 30_000, debug = false }) {
  return new Promise((resolve, reject) => {
    if (!done) {
      reject(new Error('done fn is required'))
    }

    const result = {
      stdout: [],
      stderr: [],
      url: null,
    }
    let ready = false
    let teardownCalled = false

    async function teardown () {
      if (teardownCalled) { return }
      teardownCalled = true

      timeoutId && clearTimeout(timeoutId)

      if (!child) {
        return
      }
      child.kill('SIGKILL')
      child.catch(() => { })
      child = null
    }

    let child = execa(process.execPath, [cliPath, 'start', '-c', configPath], { encoding: 'utf8' })

    const timeoutId = setTimeout(async () => {
      clearTimeout(timeoutId)

      await teardown()
      reject(new Error('Timeout'))
    }, timeout)

    child.stdout.on('data', (message) => {
      const m = message.toString()
      if (debug) {
        console.log(' >>> stdout', m)
      }

      result.stdout.push(m)

      if (done(m)) {
        teardown().then(() => {
          resolve(result)
        })
        return
      }

      if (ready) {
        return
      }

      const match = m.match(/Platformatic is now listening at (http:\/\/127\.0\.0\.1:\d+)/)
      if (match) {
        result.url = match[1]
        try {
          onReady?.({ url: result.url })
        } catch (err) {
          teardown().then(() => {
            reject(new Error('Error calling onReady', { cause: err }))
          })
        }
        ready = true
      }
    })

    child.stderr.on('data', (message) => {
      const msg = message.toString()
      if (debug) {
        console.log(' >>> stderr', msg)
      }
      result.stderr.push(msg)
    })
  })
}

module.exports = {
  getTempDir,
  moveToTmpdir,
  linkNodeModules,
  updateFile,
  updateConfigFile,
  openLogsWebsocket,
  waitForLogs,
  execRuntime,
  stdioOutputToLogs
}
