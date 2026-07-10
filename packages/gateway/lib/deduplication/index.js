import { ensureLoggableError, loadModule } from '@platformatic/foundation'
import { DynamicBuffer } from '@platformatic/dynamic-buffer'
import Router from 'find-my-way'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import stringify from 'safe-stable-stringify'
import { MemoryDeduplicationStorage } from './memory-storage.js'
import { ValkeyDeduplicationStorage } from './valkey-storage.js'

const require = createRequire(import.meta.url)
const defaultDeduplicationHeaders = ['authorization', 'cookie', 'accept', 'accept-encoding', 'accept-language']
const defaultDeduplicationMethods = ['GET', 'HEAD']

async function publishError ({ storage, key, token, responseId, config, metrics }) {
  metrics?.deduplicationError?.inc()
  await storage.setResponse(responseId, { error: true }, config.ttl)
  await storage.notify(key, responseId, config.ttl)
  await storage.unlock(key, token)
}

export async function createDeduplicationHandler ({
  app,
  application,
  baseConfig,
  overrideConfig,
  handler,
  metrics,
  root
}) {
  if (!baseConfig && !overrideConfig) {
    return handler
  }

  const config = {
    enabled: false,
    methods: defaultDeduplicationMethods,
    headers: defaultDeduplicationHeaders,
    timeout: 1000,
    retries: 3,
    ttl: 10000,
    lockTtl: 500,
    ...(baseConfig ?? {}),
    ...(overrideConfig ?? {}),
    storage: {
      ...(baseConfig?.storage ?? {}),
      ...(overrideConfig?.storage ?? {})
    }
  }
  config.storage.adapter ??= 'memory'

  if (config.enabled !== true && config.enabled !== 'true') {
    return handler
  }

  handler ??= function handler (_request, reply, dest, options) {
    return reply.from(dest, options)
  }

  const storage =
    config.storage.adapter === 'valkey'
      ? new ValkeyDeduplicationStorage(config.storage)
      : new MemoryDeduplicationStorage(config.storage)
  const methods = new Set((config.methods ?? []).map(method => method.toUpperCase()))
  let router
  let computeDeduplicationKey

  if (config.routes?.length) {
    router = Router({ defaultRoute: () => false })

    for (const route of config.routes) {
      const methods = route.methods ?? [route.method]
      for (const method of methods) {
        router.on(method, route.path, () => true)
      }
    }
  }

  if (config.key) {
    const custom = await loadModule(require, resolve(root, config.key))
    computeDeduplicationKey =
      custom.computeDeduplicationKey ?? custom.default?.computeDeduplicationKey ?? custom.default

    if (typeof computeDeduplicationKey !== 'function') {
      throw new TypeError('computeDeduplicationKey must be a function')
    }
  }

  app.addHook('onClose', async () => {
    await storage.close()
  })

  return async function deduplicationHandler (request, reply, dest, options) {
    const queryIndex = request.url.indexOf('?')
    const url = dest + (queryIndex === -1 ? '' : request.url.slice(queryIndex))

    if (router ? !router.find(request.method, request.url.split('?', 1)[0]) : !methods.has(request.method)) {
      return handler(request, reply, dest, options)
    }

    const headers = {}
    for (const header of config.headers.map(header => header.toLowerCase()).sort()) {
      const value = request.headers[header]
      if (value !== undefined) {
        headers[header] = Array.isArray(value) ? value.join(',') : String(value)
      }
    }

    const context = {
      origin: application.origin,
      method: request.method,
      url,
      query: request.query,
      headers,
      application
    }
    const key = computeDeduplicationKey
      ? computeDeduplicationKey(request, context)
      : stringify({ origin: context.origin, method: context.method, url: context.url, headers: context.headers })

    for (let attempt = 0; attempt <= config.retries; attempt++) {
      const token = randomUUID()
      const locked = await storage.lock(key, token, config.lockTtl)

      if (locked) {
        const responseId = randomUUID()
        const baseOnResponse = options.onResponse
        const baseOnError = options.onError

        async function deduplicateResponse (proxiedRequest, proxiedReply, res) {
          const body = new DynamicBuffer()

          try {
            for await (const chunk of res.stream) {
              body.append(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
            }

            await storage.setResponse(
              responseId,
              {
                statusCode: res.statusCode,
                headers: proxiedReply.getHeaders(),
                body: body.buffers
              },
              config.ttl
            )
            await storage.notify(key, responseId, config.ttl)
            await storage.unlock(key, token)
          } catch (error) {
            app.log.error({ err: ensureLoggableError(error) }, 'Error while deduplicating gateway response')
            await publishError({ storage, key, token, responseId, config, metrics })
            throw error
          }

          const stream = body.asReadable()

          if (baseOnResponse) {
            return baseOnResponse(proxiedRequest, proxiedReply, { ...res, stream })
          }

          return proxiedReply.send(stream)
        }

        async function deduplicateError (proxiedReply, error) {
          await publishError({ storage, key, token, responseId, config, metrics })

          if (baseOnError) {
            return baseOnError(proxiedReply, error)
          }

          return proxiedReply.send(error.error ?? error)
        }

        const deduplicationOptions = {
          ...options,
          deduplicateError,
          deduplicateResponse,
          onResponse: deduplicateResponse,
          onError: deduplicateError
        }

        metrics?.deduplicationLeader?.inc()

        try {
          return await handler(request, reply, dest, deduplicationOptions)
        } catch (error) {
          await publishError({ storage, key, token, responseId, config, metrics })
          throw error
        }
      }

      metrics?.deduplicationWaiter?.inc()
      const responseId = await storage.wait(key, config.timeout)
      const response = responseId ? await storage.getResponse(responseId) : null

      if (!response || response.error) {
        continue
      }

      reply.code(response.statusCode)
      reply.headers(response.headers)
      metrics?.deduplicationReplay?.inc()
      return reply.send(new DynamicBuffer(response.body).asReadable())
    }

    metrics?.deduplicationFallback?.inc()
    return handler(request, reply, dest, options)
  }
}
