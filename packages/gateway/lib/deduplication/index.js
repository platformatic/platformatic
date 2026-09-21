import { ensureLoggableError, loadModule } from '@platformatic/foundation'
import { DynamicBuffer } from '@platformatic/dynamic-buffer'
import Router from 'find-my-way'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { PassThrough } from 'node:stream'
import stringify from 'safe-stable-stringify'
import { MemoryDeduplicationStorage } from './memory-storage.js'
import { ValkeyDeduplicationStorage } from './valkey-storage.js'

const require = createRequire(import.meta.url)
const defaultDeduplicationHeaders = ['authorization', 'accept', 'accept-encoding', 'accept-language']
const defaultDeduplicationMethods = ['GET', 'HEAD']
const defaultDeduplicationSkipHeaders = ['cookie']

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
    skipHeaders: defaultDeduplicationSkipHeaders,
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
  const keyHeaders = Array.from(new Set((config.headers ?? []).map(header => header.toLowerCase()))).sort()
  const skipHeaders = Array.from(new Set((config.skipHeaders ?? []).map(header => header.toLowerCase()))).sort()
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

    for (const header of skipHeaders) {
      if (request.headers[header] !== undefined) {
        metrics?.deduplicationSkip?.inc()
        return handler(request, reply, dest, options)
      }
    }

    const headers = {}
    for (const header of keyHeaders) {
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

    // A custom key function can return a falsy value to opt the request out.
    if (!key) {
      metrics?.deduplicationSkip?.inc()
      return handler(request, reply, dest, options)
    }

    for (let attempt = 0; attempt <= config.retries; attempt++) {
      const token = randomUUID()
      const locked = await storage.lock(key, token, config.lockTtl)

      if (locked) {
        const responseId = randomUUID()
        const baseOnResponse = options.onResponse
        const baseOnError = options.onError

        async function deduplicateResponse (proxiedRequest, proxiedReply, res) {
          const body = new DynamicBuffer()

          // The client receives the body as it arrives from the upstream, while
          // the same chunks accumulate for storage. Backpressure from the client
          // is deliberately ignored: publication to the waiters must never depend
          // on how fast the leader client consumes the response, and the chunks
          // are retained in full for storage anyway, so this costs no extra
          // memory. If the client goes away mid-response, the upstream is still
          // consumed to completion so that the waiters can be served.
          const stream = new PassThrough()
          stream.on('error', () => {})

          const sent = Promise.resolve(
            baseOnResponse ? baseOnResponse(proxiedRequest, proxiedReply, { ...res, stream }) : proxiedReply.send(stream)
          )
          // The rejection is rethrown by the return below; this only prevents it
          // from being reported as unhandled while the body is still streaming.
          sent.catch(() => {})

          try {
            for await (const chunk of res.stream) {
              const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
              body.append(buffer)

              if (!stream.destroyed) {
                stream.write(buffer)
              }
            }

            stream.end()

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

            // Only sever the client when the body was actually truncated: a
            // storage failure after the body completed should not abort a
            // client which is still draining a valid response.
            if (!stream.writableEnded) {
              stream.destroy(error)
            }

            await publishError({ storage, key, token, responseId, config, metrics })
            throw error
          }

          return sent
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
