'use strict'

const { tmpdir, platform, EOL } = require('node:os')
const { join } = require('node:path')
const { exec } = require('node:child_process')
const { readdir } = require('node:fs/promises')
const { Client } = require('undici')
const WebSocket = require('ws')

const PLATFORMATIC_TMP_DIR = join(tmpdir(), 'platformatic', 'pids')
const PLATFORMATIC_PIPE_PREFIX = '\\\\.\\pipe\\platformatic-'

function getSocketPathFromPid (pid) {
  if (platform() === 'win32') {
    return PLATFORMATIC_PIPE_PREFIX + pid
  }
  return join(PLATFORMATIC_TMP_DIR, `${pid}.sock`)
}

async function getRuntimes () {
  const runtimePIDs = platform() === 'win32'
    ? await getWindowsRuntimePIDs()
    : await getUnixRuntimePIDs()

  const runtimes = []
  for (const runtimePID of runtimePIDs) {
    try {
      const runtimeMetadata = await getRuntimeMetadata(runtimePID)
      runtimes.push(runtimeMetadata)
    } catch (err) {
      continue
    }
  }
  return runtimes
}

async function getUnixRuntimePIDs () {
  const socketNames = await readdir(PLATFORMATIC_TMP_DIR)
  const runtimePIDs = []
  for (const socketName of socketNames) {
    const runtimePID = socketName.replace('.sock', '')
    runtimePIDs.push(parseInt(runtimePID))
  }
  return runtimePIDs
}

async function getWindowsRuntimePIDs () {
  const pipeNames = await getWindowsNamedPipes()
  const runtimePIDs = []
  for (const pipeName of pipeNames) {
    if (pipeName.startsWith(PLATFORMATIC_PIPE_PREFIX)) {
      const runtimePID = pipeName.replace(PLATFORMATIC_PIPE_PREFIX, '')
      runtimePIDs.push(parseInt(runtimePID))
    }
  }
  return runtimePIDs
}

async function getWindowsNamedPipes () {
  return new Promise((resolve, reject) => {
    exec(
      '[System.IO.Directory]::GetFiles("\\\\.\\pipe\\")',
      { shell: 'powershell.exe' },
      (err, stdout) => {
        if (err) {
          reject(err)
          return
        }
        const namedPipes = stdout.split(EOL)
        resolve(namedPipes)
      }
    )
  })
}

async function getRuntimeMetadata (pid) {
  const socketPath = getSocketPathFromPid(pid)
  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:'
  }, { socketPath })

  const { statusCode, body } = await client.request({
    path: '/api/metadata',
    method: 'GET'
  })

  if (statusCode !== 200) {
    const error = await body.text()
    throw new Error(`Failed to get runtime metadata: ${error}`)
  }

  const metadata = await body.json()
  return metadata
}

async function getRuntimeServices (pid) {
  const socketPath = getSocketPathFromPid(pid)
  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:'
  }, { socketPath })

  const { statusCode, body } = await client.request({
    path: '/api/services',
    method: 'GET'
  })

  if (statusCode !== 200) {
    const error = await body.text()
    throw new Error(`Failed to get runtime services: ${error}`)
  }

  const runtimeServices = await body.json()
  return runtimeServices
}

async function getRuntimeEnv (pid) {
  const socketPath = getSocketPathFromPid(pid)
  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:'
  }, { socketPath })

  const { statusCode, body } = await client.request({
    path: '/api/env',
    method: 'GET'
  })

  if (statusCode !== 200) {
    const error = await body.text()
    throw new Error(`Failed to get runtime env: ${error}`)
  }

  const runtimeEnv = await body.json()
  return runtimeEnv
}

async function getRuntimeByPackageName (packageName) {
  const runtimes = await getRuntimes()
  return runtimes.find(runtime => runtime.packageName === packageName)
}

async function getRuntimeByPID (pid) {
  const runtimes = await getRuntimes()
  return runtimes.find(runtime => runtime.pid === pid)
}

async function stopRuntimeServices (pid) {
  const socketPath = getSocketPathFromPid(pid)
  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:'
  }, { socketPath })

  const { statusCode, body } = await client.request({
    path: '/api/services/stop',
    method: 'POST'
  })

  if (statusCode !== 200) {
    const error = await body.text()
    throw new Error(`Failed to stop runtime services: ${error}`)
  }
}

async function startRuntimeServices (pid) {
  const socketPath = getSocketPathFromPid(pid)
  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:'
  }, { socketPath })

  const { statusCode, body } = await client.request({
    path: '/api/services/start',
    method: 'POST'
  })

  if (statusCode !== 200) {
    const error = await body.text()
    throw new Error(`Failed to start runtime services: ${error}`)
  }
}

async function restartRuntimeServices (pid) {
  const socketPath = getSocketPathFromPid(pid)
  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:'
  }, { socketPath })

  const { statusCode, body } = await client.request({
    path: '/api/services/restart',
    method: 'POST'
  })

  if (statusCode !== 200) {
    const error = await body.text()
    throw new Error(`Failed to restart runtime services: ${error}`)
  }
}

async function closeRuntimeServices (pid) {
  const socketPath = getSocketPathFromPid(pid)
  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:'
  }, { socketPath })

  const { statusCode, body } = await client.request({
    path: '/api/services/close',
    method: 'POST'
  })

  if (statusCode !== 200) {
    const error = await body.text()
    throw new Error(`Failed to close runtime services: ${error}`)
  }
}

function pipeRuntimeLogsStream (pid, options, onMessage) {
  const socketPath = getSocketPathFromPid(pid)
  let query = ''
  if (options.level || options.pretty) {
    query = '?' + new URLSearchParams(options).toString()
  }

  const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
  const webSocket = new WebSocket(protocol + socketPath + ':/api/logs' + query)

  webSocket.on('error', (err) => {
    throw new Error(`WebSocket error: ${err.message}`)
  })

  webSocket.on('message', (data) => {
    onMessage(data.toString())
  })
}

async function injectRuntime (pid, serviceId, options) {
  const socketPath = getSocketPathFromPid(pid)
  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:'
  }, { socketPath })

  const response = await client.request({
    path: `/api/services/${serviceId}/proxy` + options.url,
    method: options.method,
    headers: options.headers,
    query: options.query,
    body: options.body
  })

  const body = await response.body.text()

  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body
  }
}

module.exports = {
  getRuntimes,
  getRuntimeMetadata,
  getRuntimeServices,
  injectRuntime,
  getRuntimeEnv,
  getRuntimeByPID,
  getRuntimeByPackageName,
  stopRuntimeServices,
  startRuntimeServices,
  restartRuntimeServices,
  closeRuntimeServices,
  pipeRuntimeLogsStream
}
