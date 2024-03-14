'use strict'

const { tmpdir, platform, EOL } = require('node:os')
const { join } = require('node:path')
const { exec, spawn } = require('node:child_process')
const { readdir, unlink, access } = require('node:fs/promises')
const { Readable } = require('node:stream')
const { Client } = require('undici')
const WebSocket = require('ws')
const errors = require('./errors.js')

const PLATFORMATIC_TMP_DIR = join(tmpdir(), 'platformatic', 'runtimes')
const PLATFORMATIC_PIPE_PREFIX = '\\\\.\\pipe\\platformatic-'

class RuntimeApiClient {
  #undiciClients = new Map()
  #webSockets = new Set()

  async getMatchingRuntime (opts) {
    const runtimes = await this.getRuntimes()

    let runtime = null
    if (opts.pid) {
      runtime = runtimes.find(runtime => runtime.pid === parseInt(opts.pid))
    } else if (opts.name) {
      runtime = runtimes.find(runtime => runtime.packageName === opts.name)
    } else if (runtimes.length === 1) {
      runtime = runtimes[0]
    }
    if (!runtime) {
      throw errors.RuntimeNotFound()
    }
    return runtime
  }

  async getRuntimes () {
    const runtimePIDs = platform() === 'win32'
      ? await this.#getWindowsRuntimePIDs()
      : await this.#getUnixRuntimePIDs()

    const getMetadataRequests = await Promise.allSettled(
      runtimePIDs.map(async (runtimePID) => {
        return this.getRuntimeMetadata(runtimePID)
      })
    )

    const runtimes = []
    for (let i = 0; i < runtimePIDs.length; i++) {
      const runtimePID = runtimePIDs[i]
      const metadataRequest = getMetadataRequests[i]

      if (metadataRequest.status === 'rejected') {
        await this.#removeRuntimeSocket(runtimePID).catch(() => {})
      } else {
        runtimes.push(metadataRequest.value)
      }
    }
    return runtimes
  }

  async getRuntimeMetadata (pid) {
    const client = this.#getUndiciClient(pid)

    const { statusCode, body } = await client.request({
      path: '/api/v1/metadata',
      method: 'GET'
    })

    if (statusCode !== 200) {
      const error = await body.text()
      throw new errors.FailedToGetRuntimeMetadata(error)
    }

    const metadata = await body.json()
    return metadata
  }

  async getRuntimeServices (pid) {
    const client = this.#getUndiciClient(pid)

    const { statusCode, body } = await client.request({
      path: '/api/v1/services',
      method: 'GET'
    })

    if (statusCode !== 200) {
      const error = await body.text()
      throw new errors.FailedToGetRuntimeServices(error)
    }

    const runtimeServices = await body.json()
    return runtimeServices
  }

  async getRuntimeServiceConfig (pid, serviceId) {
    const client = this.#getUndiciClient(pid)

    const { statusCode, body } = await client.request({
      path: `/api/v1/services/${serviceId}/config`,
      method: 'GET'
    })

    if (statusCode !== 200) {
      const error = await body.text()
      throw new errors.FailedToGetRuntimeServiceConfig(error)
    }

    const serviceConfig = await body.json()
    return serviceConfig
  }

  async getRuntimeConfig (pid) {
    const client = this.#getUndiciClient(pid)

    const { statusCode, body } = await client.request({
      path: '/api/v1/config',
      method: 'GET'
    })

    if (statusCode !== 200) {
      const error = await body.text()
      throw new errors.FailedToGetRuntimeConfig(error)
    }

    const runtimeConfig = await body.json()
    return runtimeConfig
  }

  async getRuntimeEnv (pid) {
    const client = this.#getUndiciClient(pid)

    const { statusCode, body } = await client.request({
      path: '/api/v1/env',
      method: 'GET'
    })

    if (statusCode !== 200) {
      const error = await body.text()
      throw new errors.FailedToGetRuntimeEnv(error)
    }

    const runtimeEnv = await body.json()
    return runtimeEnv
  }

  async restartRuntime (pid, options = {}) {
    const runtime = await this.getMatchingRuntime({ pid })

    await this.stopRuntime(pid)

    const [startCommand, ...startArgs] = runtime.argv
    const child = spawn(startCommand, startArgs, { cwd: runtime.cwd, ...options })
    return child
  }

  async reloadRuntime (pid) {
    const client = this.#getUndiciClient(pid)

    const { statusCode, body } = await client.request({
      path: '/api/v1/reload',
      method: 'POST'
    })

    if (statusCode !== 200) {
      const error = await body.text()
      throw new errors.FailedToReloadRuntime(error)
    }
  }

  async stopRuntime (pid) {
    const client = this.#getUndiciClient(pid)

    const { statusCode, body } = await client.request({
      path: '/api/v1/stop',
      method: 'POST'
    })

    if (statusCode !== 200) {
      const error = await body.text()
      throw new errors.FailedToStopRuntime(error)
    }
  }

  getRuntimeLiveMetricsStream (pid) {
    const socketPath = this.#getSocketPathFromPid(pid)

    const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
    const webSocketUrl = protocol + socketPath + ':/api/v1/metrics/live'
    const webSocketStream = new WebSocketStream(webSocketUrl)
    this.#webSockets.add(webSocketStream.ws)

    return webSocketStream
  }

  getRuntimeLiveLogsStream (pid, startLogIndex) {
    const socketPath = this.#getSocketPathFromPid(pid)

    const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
    const query = startLogIndex ? `?start=${startLogIndex}` : ''
    const webSocketUrl = protocol + socketPath + ':/api/v1/logs/live' + query
    const webSocketStream = new WebSocketStream(webSocketUrl)
    this.#webSockets.add(webSocketStream.ws)

    return webSocketStream
  }

  async getRuntimeLogsStream (pid, logsId) {
    const client = this.#getUndiciClient(pid)

    const { statusCode, body } = await client.request({
      path: '/api/v1/logs/' + logsId,
      method: 'GET'
    })

    if (statusCode !== 200) {
      const error = await body.text()
      throw new errors.FailedToGetRuntimeHistoryLogs(error)
    }

    return body
  }

  async getRuntimeLogIndexes (pid) {
    const client = this.#getUndiciClient(pid)

    const { statusCode, body } = await client.request({
      path: '/api/v1/logs/indexes',
      method: 'GET'
    })

    if (statusCode !== 200) {
      const error = await body.text()
      throw new errors.FailedToGetRuntimeLogIndexes(error)
    }

    const { indexes } = await body.json()
    return indexes
  }

  async injectRuntime (pid, serviceId, options) {
    const client = this.#getUndiciClient(pid)

    const response = await client.request({
      path: `/api/v1/services/${serviceId}/proxy` + options.url,
      method: options.method,
      headers: options.headers,
      query: options.query,
      body: options.body
    })
    return response
  }

  async close () {
    for (const client of this.#undiciClients.values()) {
      client.close()
    }
    for (const webSocket of this.#webSockets) {
      webSocket.close()
    }
  }

  #getUndiciClient (pid) {
    let undiciClient = this.#undiciClients.get(pid)
    if (!undiciClient) {
      const socketPath = this.#getSocketPathFromPid(pid)
      undiciClient = new Client({
        hostname: 'localhost',
        protocol: 'http:'
      }, { socketPath })

      this.#undiciClients.set(pid, undiciClient)
    }
    return undiciClient
  }

  #getSocketPathFromPid (pid) {
    if (platform() === 'win32') {
      return PLATFORMATIC_PIPE_PREFIX + pid
    }
    return join(PLATFORMATIC_TMP_DIR, pid.toString(), 'socket')
  }

  async #getUnixRuntimePIDs () {
    try {
      await access(PLATFORMATIC_TMP_DIR)
    } catch {
      return []
    }
    const runtimeDirs = await readdir(PLATFORMATIC_TMP_DIR)
    const runtimePIDs = []
    for (const runtimeDirName of runtimeDirs) {
      runtimePIDs.push(parseInt(runtimeDirName))
    }
    return runtimePIDs
  }

  async #getWindowsRuntimePIDs () {
    const pipeNames = await this.#getWindowsNamedPipes()
    const runtimePIDs = []
    for (const pipeName of pipeNames) {
      if (pipeName.startsWith(PLATFORMATIC_PIPE_PREFIX)) {
        const runtimePID = pipeName.replace(PLATFORMATIC_PIPE_PREFIX, '')
        runtimePIDs.push(parseInt(runtimePID))
      }
    }
    return runtimePIDs
  }

  async #getWindowsNamedPipes () {
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

  async #removeRuntimeSocket (pid) {
    if (platform() !== 'win32') {
      const socketPath = this.#getSocketPathFromPid(pid)
      await unlink(socketPath)
    }
  }
}

class WebSocketStream extends Readable {
  constructor (url) {
    super()
    this.ws = new WebSocket(url)

    this.ws.on('message', (data) => {
      this.push(data)
    })
    this.ws.on('close', () => {
      this.push(null)
    })
    this.ws.on('error', (err) => {
      this.emit('error', new errors.FailedToStreamRuntimeLogs(err.message))
    })
    this.on('close', () => {
      this.ws.close()
    })
  }

  _read () {}
}

module.exports = RuntimeApiClient
