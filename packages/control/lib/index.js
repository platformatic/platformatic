import { safeRemove } from '@platformatic/foundation'
import { exec, spawn } from 'node:child_process'
import { access, readdir } from 'node:fs/promises'
import { EOL, platform, tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { Client } from 'undici'
import WebSocket from 'ws'
import {
  FailedToGetRuntimeAllLogs,
  FailedToGetRuntimeConfig,
  FailedToGetRuntimeEnv,
  FailedToGetRuntimeHistoryLogs,
  FailedToGetRuntimeLogIndexes,
  FailedToGetRuntimeMetadata,
  FailedToGetRuntimeMetrics,
  FailedToGetRuntimeOpenapi,
  FailedToGetRuntimeServiceConfig,
  FailedToGetRuntimeServiceEnv,
  FailedToGetRuntimeServices,
  FailedToReloadRuntime,
  FailedToStopRuntime,
  FailedToStreamRuntimeLogs,
  RuntimeNotFound,
  ServiceNotFound
} from './errors.js'

const PLATFORMATIC_TMP_DIR = join(tmpdir(), 'platformatic', 'runtimes')
const PLATFORMATIC_PIPE_PREFIX = '\\\\.\\pipe\\platformatic-'

class WebSocketStream extends Readable {
  constructor (url) {
    super()
    this.ws = new WebSocket(url)

    this.ws.on('message', data => {
      this.push(data)
    })
    this.ws.on('close', () => {
      this.push(null)
    })
    this.ws.on('error', err => {
      this.emit('error', new FailedToStreamRuntimeLogs(err.message))
    })
    this.on('close', () => {
      this.ws.close()
    })
  }

  _read () {}
}

export * from './errors.js'

export class RuntimeApiClient {
  #undiciClients = new Map()
  #webSockets = new Set()

  async getMatchingRuntime (opts = {}) {
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
      throw new RuntimeNotFound()
    }
    return runtime
  }

  async getRuntimes () {
    const runtimePIDs = platform() === 'win32' ? await this.#getWindowsRuntimePIDs() : await this.#getUnixRuntimePIDs()

    const getMetadataRequests = await Promise.allSettled(
      runtimePIDs.map(async runtimePID => {
        return this.getRuntimeMetadata(runtimePID)
      })
    )

    const runtimes = []
    for (let i = 0; i < runtimePIDs.length; i++) {
      const runtimePID = runtimePIDs[i]
      const metadataRequest = getMetadataRequests[i]

      if (metadataRequest.status === 'rejected') {
        await this.#removeRuntimeTmpDir(runtimePID).catch(() => {})
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
      method: 'GET',
      headersTimeout: 10 * 1000
    })

    if (statusCode !== 200) {
      const error = await body.text()
      throw new FailedToGetRuntimeMetadata(error)
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
      throw new FailedToGetRuntimeServices(error)
    }

    const runtimeServices = await body.json()
    return runtimeServices
  }

  async getRuntimeConfig (pid) {
    const client = this.#getUndiciClient(pid)

    const { statusCode, body } = await client.request({
      path: '/api/v1/config',
      method: 'GET'
    })

    if (statusCode !== 200) {
      const error = await body.text()
      throw new FailedToGetRuntimeConfig(error)
    }

    const runtimeConfig = await body.json()
    return runtimeConfig
  }

  async getRuntimeServiceConfig (pid, serviceId) {
    const client = this.#getUndiciClient(pid)

    const { statusCode, body } = await client.request({
      path: `/api/v1/services/${serviceId}/config`,
      method: 'GET'
    })

    if (statusCode !== 200) {
      const error = await body.text()
      let jsonError
      try {
        jsonError = JSON.parse(error)
      } catch {
        // No-op
      }

      if (
        jsonError?.code === 'PLT_RUNTIME_SERVICE_NOT_FOUND' ||
        jsonError?.code === 'PLT_RUNTIME_SERVICE_WORKER_NOT_FOUND'
      ) {
        throw new ServiceNotFound(error)
      }

      throw new FailedToGetRuntimeServiceConfig(error)
    }

    const serviceConfig = await body.json()
    return serviceConfig
  }

  async getRuntimeEnv (pid) {
    const client = this.#getUndiciClient(pid)

    const { statusCode, body } = await client.request({
      path: '/api/v1/env',
      method: 'GET'
    })

    if (statusCode !== 200) {
      const error = await body.text()
      throw new FailedToGetRuntimeEnv(error)
    }

    const runtimeEnv = await body.json()
    return runtimeEnv
  }

  async getRuntimeOpenapi (pid, serviceId) {
    const client = this.#getUndiciClient(pid)

    const { statusCode, body } = await client.request({
      path: `/api/v1/services/${serviceId}/openapi-schema`,
      method: 'GET'
    })

    if (statusCode !== 200) {
      const error = await body.text()
      throw new FailedToGetRuntimeOpenapi(error)
    }

    const openapi = await body.json()
    return openapi
  }

  async getRuntimeServiceEnv (pid, serviceId) {
    const client = this.#getUndiciClient(pid)

    const { statusCode, body } = await client.request({
      path: `/api/v1/services/${serviceId}/env`,
      method: 'GET'
    })

    if (statusCode !== 200) {
      const error = await body.text()
      let jsonError
      try {
        jsonError = JSON.parse(error)
      } catch {
        // No-op
      }

      if (
        jsonError?.code === 'PLT_RUNTIME_SERVICE_NOT_FOUND' ||
        jsonError?.code === 'PLT_RUNTIME_SERVICE_WORKER_NOT_FOUND'
      ) {
        throw new ServiceNotFound(error)
      }

      throw new FailedToGetRuntimeServiceEnv(error)
    }

    const serviceConfig = await body.json()
    return serviceConfig
  }

  async reloadRuntime (pid, options = {}) {
    const runtime = await this.getMatchingRuntime({ pid })

    await this.stopRuntime(pid)

    const [startCommand, ...startArgs] = runtime.argv
    const child = spawn(startCommand, startArgs, { cwd: runtime.cwd, ...options, stdio: 'ignore', detached: true })

    await new Promise((resolve, reject) => {
      child.on('spawn', resolve)
      child.on('error', reject)
    })

    child.unref()
    return child
  }

  async restartRuntime (pid) {
    const client = this.#getUndiciClient(pid)

    const { statusCode, body } = await client.request({
      path: '/api/v1/restart',
      method: 'POST'
    })

    if (statusCode !== 200) {
      const error = await body.text()
      throw new FailedToReloadRuntime(error)
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
      throw new FailedToStopRuntime(error)
    }
  }

  async getRuntimeMetrics (pid, options = {}) {
    const client = this.#getUndiciClient(pid)

    const format = options.format ?? 'text'
    const headers = {}
    if (format === 'json') {
      headers['accept'] = 'application/json'
    }
    if (format === 'text') {
      headers['accept'] = 'text/plain'
    }

    const { statusCode, body } = await client.request({
      path: '/api/v1/metrics',
      method: 'GET',
      headers
    })

    if (statusCode !== 200) {
      const error = await body.text()
      throw new FailedToGetRuntimeMetrics(error)
    }

    const metrics = format === 'json' ? await body.json() : await body.text()

    return metrics
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

  async getRuntimeLogsStream (pid, logsId, options = {}) {
    const runtimePID = options.runtimePID ?? pid
    const client = this.#getUndiciClient(pid)

    const { statusCode, body } = await client.request({
      path: '/api/v1/logs/' + logsId,
      method: 'GET',
      query: { pid: runtimePID }
    })

    if (statusCode !== 200) {
      const error = await body.text()
      throw new FailedToGetRuntimeHistoryLogs(error)
    }

    return body
  }

  async getRuntimeAllLogsStream (pid, options = {}) {
    const runtimePID = options.runtimePID ?? pid
    const client = this.#getUndiciClient(pid)

    const { statusCode, body } = await client.request({
      path: '/api/v1/logs/all',
      method: 'GET',
      query: { pid: runtimePID }
    })

    if (statusCode !== 200) {
      const error = await body.text()
      throw new FailedToGetRuntimeAllLogs(error)
    }

    return body
  }

  async getRuntimeLogIndexes (pid, options = {}) {
    const all = options.all ?? false
    const client = this.#getUndiciClient(pid)

    const { statusCode, body } = await client.request({
      path: '/api/v1/logs/indexes',
      method: 'GET',
      query: { all }
    })

    if (statusCode !== 200) {
      const error = await body.text()
      throw new FailedToGetRuntimeLogIndexes(error)
    }

    const result = await body.json()
    if (all) return result

    return result.indexes
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
      undiciClient = new Client(
        {
          hostname: 'localhost',
          protocol: 'http:'
        },
        { socketPath }
      )

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

    const runtimeDirs = await readdir(PLATFORMATIC_TMP_DIR, { withFileTypes: true })
    const runtimePIDs = []

    for (const runtimeDir of runtimeDirs) {
      // Only consider directory that can be a PID
      if (runtimeDir.isDirectory() && runtimeDir.name.match(/^\d+$/)) {
        runtimePIDs.push(parseInt(runtimeDir.name))
      }
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
      exec('[System.IO.Directory]::GetFiles("\\\\.\\pipe\\")', { shell: 'powershell.exe' }, (err, stdout) => {
        if (err) {
          reject(err)
          return
        }
        const namedPipes = stdout.split(EOL)
        resolve(namedPipes)
      })
    })
  }

  async #removeRuntimeTmpDir (pid) {
    const runtimeDir = join(PLATFORMATIC_TMP_DIR, pid.toString())
    await safeRemove(runtimeDir)
  }
}
