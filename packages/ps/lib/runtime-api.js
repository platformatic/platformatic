'use strict'

const { tmpdir, platform } = require('node:os')
const { join } = require('node:path')
const { readdir } = require('node:fs/promises')
const { Client } = require('undici')
const WebSocket = require('ws')

const PLATFORMATIC_TMP_DIR = join(tmpdir(), 'platformatic', 'pids')

function getSocketPathFromPid (pid) {
  if (platform() === 'win32') {
    return '\\\\.\\pipe\\platformatic-' + pid
  }
  return join(PLATFORMATIC_TMP_DIR, `${pid}.sock`)
}

async function getRuntimes () {
  const socketNames = await readdir(PLATFORMATIC_TMP_DIR)

  const runtimes = []
  for (const socketName of socketNames) {
    const runtimePid = socketName.replace('.sock', '')
    try {
      const runtimeMetadata = await getRuntimeMetadata(runtimePid)
      runtimes.push(runtimeMetadata)
    } catch (err) {
      continue
    }
  }
  return runtimes
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

module.exports = {
  getRuntimes,
  getRuntimeMetadata,
  getRuntimeEnv,
  getRuntimeByPID,
  getRuntimeByPackageName,
  stopRuntimeServices,
  startRuntimeServices,
  restartRuntimeServices,
  closeRuntimeServices,
  pipeRuntimeLogsStream
}
