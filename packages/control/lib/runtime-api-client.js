'use strict'

const { tmpdir, platform, EOL } = require('node:os')
const { join } = require('node:path')
const { exec } = require('node:child_process')
const { readdir } = require('node:fs/promises')
const { Client } = require('undici')
const WebSocket = require('ws')
const errors = require('./errors.js')

const PLATFORMATIC_TMP_DIR = join(tmpdir(), 'platformatic', 'pids')
const PLATFORMATIC_PIPE_PREFIX = '\\\\.\\pipe\\platformatic-'

class RuntimeApiClient {
  #undiciClients = new Map()
  #webSockets = new Set()

  async getRuntimes () {
    const runtimePIDs = platform() === 'win32'
      ? await this.#getWindowsRuntimePIDs()
      : await this.#getUnixRuntimePIDs()

    const runtimes = []
    for (const runtimePID of runtimePIDs) {
      try {
        const runtimeMetadata = await this.getRuntimeMetadata(runtimePID)
        runtimes.push(runtimeMetadata)
      } catch (err) {
        continue
      }
    }
    return runtimes
  }

  async getRuntimeMetadata (pid) {
    const client = this.#getUndiciClient(pid)

    const { statusCode, body } = await client.request({
      path: '/api/metadata',
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
      path: '/api/services',
      method: 'GET'
    })

    if (statusCode !== 200) {
      const error = await body.text()
      throw new errors.FailedToGetRuntimeServices(error)
    }

    const runtimeServices = await body.json()
    return runtimeServices
  }

  async getRuntimeEnv (pid) {
    const client = this.#getUndiciClient(pid)

    const { statusCode, body } = await client.request({
      path: '/api/env',
      method: 'GET'
    })

    if (statusCode !== 200) {
      const error = await body.text()
      throw new errors.FailedToGetRuntimeEnv(error)
    }

    const runtimeEnv = await body.json()
    return runtimeEnv
  }

  async getRuntimeByPackageName (packageName) {
    const runtimes = await this.getRuntimes()
    return runtimes.find(runtime => runtime.packageName === packageName)
  }

  async getRuntimeByPID (pid) {
    const runtimes = await this.getRuntimes()
    return runtimes.find(runtime => runtime.pid === pid)
  }

  async stopRuntimeServices (pid) {
    const client = this.#getUndiciClient(pid)

    const { statusCode, body } = await client.request({
      path: '/api/services/stop',
      method: 'POST'
    })

    if (statusCode !== 200) {
      const error = await body.text()
      throw new errors.FailedToStopRuntimeServices(error)
    }
  }

  async startRuntimeServices (pid) {
    const client = this.#getUndiciClient(pid)

    const { statusCode, body } = await client.request({
      path: '/api/services/start',
      method: 'POST'
    })

    if (statusCode !== 200) {
      const error = await body.text()
      throw new errors.FailedToStartRuntimeServices(error)
    }
  }

  async restartRuntimeServices (pid) {
    const client = this.#getUndiciClient(pid)

    const { statusCode, body } = await client.request({
      path: '/api/services/restart',
      method: 'POST'
    })

    if (statusCode !== 200) {
      const error = await body.text()
      throw new errors.FailedToRestartRuntimeServices(error)
    }
  }

  async closeRuntime (pid) {
    const client = this.#getUndiciClient(pid)

    const { statusCode, body } = await client.request({
      path: '/api/services/close',
      method: 'POST'
    })

    if (statusCode !== 200) {
      const error = await body.text()
      throw new errors.FailedToCloseRuntime(error)
    }
  }

  pipeRuntimeLogsStream (pid, options, onMessage) {
    const socketPath = this.#getSocketPathFromPid(pid)
    let query = ''
    if (options.level || options.pretty || options.serviceId) {
      query = '?' + new URLSearchParams(options).toString()
    }

    const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
    const webSocket = new WebSocket(protocol + socketPath + ':/api/logs' + query)
    this.#webSockets.add(webSocket)

    webSocket.on('error', (err) => {
      throw new errors.FailedToStreamRuntimeLogs(err.message)
    })

    webSocket.on('message', (data) => {
      onMessage(data.toString())
    })
  }

  async injectRuntime (pid, serviceId, options) {
    const client = this.#getUndiciClient(pid)

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
    return join(PLATFORMATIC_TMP_DIR, `${pid}.sock`)
  }

  async #getUnixRuntimePIDs () {
    const socketNames = await readdir(PLATFORMATIC_TMP_DIR)
    const runtimePIDs = []
    for (const socketName of socketNames) {
      const runtimePID = socketName.replace('.sock', '')
      runtimePIDs.push(parseInt(runtimePID))
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
}

module.exports = RuntimeApiClient
