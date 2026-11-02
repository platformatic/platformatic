import { ensureLoggableError, loadModule } from '@platformatic/foundation'
import Router from 'find-my-way'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { Readable } from 'node:stream'
import {
  EarlyFlushCancelledError,
  EarlyFlushInvalidOptionError,
  EarlyFlushMismatchError,
  EarlyFlushUpstreamError
} from '../errors.js'
import { nonReplayableHeaders, toHeaders } from './headers.js'
import { defaultPreludeKeyResolver, resolveOptions } from './options.js'
import { Sampler } from './sampler.js'

export const kEarlyFlush = Symbol('plt.gateway.earlyFlush')

/**
 * Creates one persistent learner for an application's explicitly admitted proxy routes.
 * A hit exposes prepared status, headers and prefix bytes without waiting for the upstream
 * response. Once exposed, they cannot be replaced with the eventual response metadata.
 *
 * The output has two phases: an immediate prefix, then demand-driven upstream reads.
 * Active preludes freeze HTML learning: chunks are verified and forwarded without capturing
 * samples or recomputing the window. A mismatch invalidates the generation so later requests
 * learn again. Redirects still update their policy; failures never replace the exposed document.
 * Deduplication supplies the complete response and gateway compression wraps the final stream.
 */
export async function createEarlyFlushHandler ({ app, application, handler, acquireResponse, root, send }) {
  const options = application.proxy?.earlyFlush
  if (!options || (options.enabled !== true && options.enabled !== 'true') || !options.routes?.length) {
    return handler
  }

  const config = resolveOptions({
    ...options,
    memory: { maxKeys: options.maxKeys },
    onSamplingError (error) {
      app.log.warn({ err: ensureLoggableError(error) }, 'Early flush sampling failed')
    },
    onEarlyFlushEvent (event) {
      app.log.debug({ earlyFlush: event, application: application.id }, 'Gateway early flush')
    }
  })

  const router = Router()
  for (const route of options.routes) {
    router.on(route.methods ?? route.method, route.path, () => {}, { route: route.path })
  }

  let preludeKey
  if (options.key) {
    const custom = await loadModule(createRequire(import.meta.url), resolve(root, options.key))
    preludeKey = typeof custom === 'function'
      ? custom
      : custom.computePreludeKey ?? custom.default?.computePreludeKey ?? custom.default

    if (typeof preludeKey !== 'function') {
      throw new EarlyFlushInvalidOptionError('key must export computePreludeKey or a default function')
    }
  }

  const sampler = new Sampler(config)
  const storage = sampler.storage
  app.addHook('onClose', async () => {
    await storage.invalidateAll()
  })

  handler ??= (request, reply, dest, options) => reply.from(dest, options)
  send ??= (request, reply, stream) => reply.send(stream)

  function emit (request, type, fields = {}) {
    request.log.debug({ earlyFlush: { type, ...fields }, application: application.id }, 'Gateway early flush')
  }

  return async function earlyFlushHandler (request, reply, dest, options) {
    const match = router.find(request.method, request.url.split('?', 1)[0])
    if (
      !match ||
      request.headers.upgrade ||
      request.headers.range !== undefined ||
      Object.keys(request.headers).some(name => name.startsWith('if-'))
    ) {
      return handler(request, reply, dest, options)
    }

    // Resolve routing once before key construction. The native request retains its original
    // URL and headers for custom variants; no body is consumed just to construct a key.
    // Unlike URL-specific keys, the default deliberately shares the matched route pattern.
    let key
    try {
      key = preludeKey
        ? await preludeKey(request, { route: match.store.route, params: match.params, application })
        : defaultPreludeKeyResolver({ method: request.method, route: match.store.route })

      if (!key) {
        reply.header('x-early-flush', 'bypass')
        emit(request, 'decision', { outcome: 'bypass', reason: 'resolver' })
        return handler(request, reply, dest, options)
      }

      if (typeof key !== 'string') {
        throw new EarlyFlushInvalidOptionError('computePreludeKey must return a string or an empty value')
      }
    } catch (error) {
      // Optional learning must not turn a resolver failure into an application failure.
      request.log.warn({ err: ensureLoggableError(error) }, 'Early flush key resolution failed')
      reply.header('x-early-flush', 'bypass')
      return handler(request, reply, dest, options)
    }

    const admission = await sampler.begin(
      {
        method: request.method,
        url: new URL(request.url, `${request.protocol}://${request.host}`).href,
        headers: toHeaders(request.headers),
        route: match.store.route
      },
      key
    )
    if (admission.result === 'bypass') {
      reply.header('x-early-flush', 'bypass')
      emit(request, 'decision', { outcome: 'bypass', reason: admission.reason })
      return handler(request, reply, dest, options)
    }

    const { ticket } = admission

    // HEAD never selects a body prelude. Selection validates the ticket generation atomically.
    const selection = request.method === 'HEAD' ? { result: 'miss' } : await sampler.prelude(ticket)
    if (selection.result === 'bypass') {
      reply.header('x-early-flush', 'bypass')
      emit(request, 'decision', { outcome: 'bypass', reason: selection.reason })
      return handler(request, reply, dest, options)
    }

    const prelude = selection.result === 'hit' ? selection.prelude : undefined

    if (reply.raw.destroyed) {
      return reply
    }

    // Only an admitted, nonempty key changes upstream negotiation. Resolver bypass retains
    // the gateway's ordinary behavior instead of forcing identity on behalf of early flush.
    request[kEarlyFlush] = true
    const decision = request.method === 'HEAD' ? 'bypass' : prelude ? 'hit' : 'miss'

    // Decide before contacting the upstream, even when it later fails. The diagnostic header
    // records this initial decision, not eventual eligibility or successful completion.
    emit(request, 'decision', { outcome: decision })

    const pending = Promise.withResolvers()
    // Attach a rejection handler immediately: the consumer may cancel or never read again,
    // so no later body read can be relied on to observe an upstream failure.
    pending.promise.catch(() => {})

    let source
    // Awaited operations may resume after cancellation. Recheck this flag before forwarding
    // bytes or committing a sample so continuations cannot act on a terminated response.
    let cancelled = false
    let output
    let terminal = false
    const initialHeaders = reply.getHeaders()

    // Source failure, socket closure and output completion can race. A hit reports at most
    // one terminal event; upstream verification alone does not mean the output is complete.
    function finish (type, fields) {
      if (!terminal && prelude) {
        terminal = true
        emit(request, type, fields)
      }
    }

    function cancel () {
      if (!reply.raw.writableFinished) {
        // Wake a generator waiting for the response head, discard partial learning and
        // destroy its current output/source. With deduplication, this source is the client's
        // intermediate stream; the leader still consumes shared upstream work for waiters.
        cancelled = true
        const error = new EarlyFlushCancelledError()
        pending.reject(error)
        source?.destroy()
        output?.destroy(error)
        finish('cancelled')
      }
    }

    function completed () {
      // A compressed hit completes only after the final output has been written, including
      // its encoder trailer. Raw upstream EOF merely emits the separate verified event.
      finish('completed')
    }

    reply.raw.once('close', cancel)
    reply.raw.once('finish', completed)
    reply.raw.once('close', () => {
      reply.raw.removeListener('finish', completed)
    })

    // The producer returns upstream metadata and bytes without touching the client reply.
    // A response arriving after cancellation still belongs to us and must be disposed of.
    try {
      Promise.resolve(acquireResponse(request, reply, dest, options)).then(response => {
        source = response.stream
        source.on('error', () => {})
        if (cancelled) {
          source.destroy()
        }
        pending.resolve(response)
      }).catch(pending.reject)
    } catch (error) {
      pending.reject(error)
    }

    async function mismatch (reason) {
      // Invalidation checks the ticket's generation atomically, so a slow request cannot
      // delete replacement state created after eviction or an earlier invalidation.
      await sampler.invalidate(ticket, reason)
      throw new EarlyFlushMismatchError(reason)
    }

    async function * body (response) {
      // This offset spans input chunks and stops growing once the entire prelude is verified.
      let prefixBytes = 0
      let suffixBytes = 0
      let sampledResponse

      try {
        if (prelude) {
          // Yield the prefix before waiting for the response head so the consumer's first
          // read can complete independently of the upstream renderer or deduplication waiter.
          yield prelude.prefix
          response = await pending.promise
        }
        if (cancelled) {
          return
        }

        const { statusCode: status, stream } = response
        const headers = toHeaders({ ...initialHeaders, ...response.headers })

        // Validate metadata once, before suffix streaming. Frozen learning must not bypass
        // eligibility: cookies, nonce-bearing CSP, encoding and Vary still apply to every hit.
        if (prelude) {
          if (status >= 300 && status < 400 && status !== 304) {
            sampledResponse = await sampler.response(ticket, status, headers)
            if (cancelled) {
              return
            }

            // The exposed response head cannot become an HTTP redirect. Drain eligible
            // redirects to EOF before committing their status sample: policy must not learn
            // from incomplete bodies. Retain and forward none of their bytes, then terminate
            // the output without redirect HTML or a navigation fallback.
            for await (const chunk of stream) {
              suffixBytes += chunk.length
            }
            if (cancelled) {
              return
            }

            await sampledResponse?.complete()
            emit(request, 'redirect', { status, discardedBytes: suffixBytes })
            throw new EarlyFlushUpstreamError(`late redirect (${status})`)
          }

          if (status >= 400) {
            // Application errors neither train the window nor invalidate an otherwise valid
            // prelude. They only terminate this already-started response.
            throw new EarlyFlushUpstreamError(`HTTP ${status}`)
          }

          const eligible = await sampler.eligible(ticket, status, headers)
          if (cancelled) {
            return
          }
          if (!eligible) {
            await mismatch('response-ineligible')
          }
          if (status !== prelude.status) {
            await mismatch('status-mismatch')
          }

          // Compare exact replayable values, including omitted headers. Configured
          // Cache-Control deliberately overrides the upstream value. Eligibility above still
          // sees the original response, including metadata excluded from replay.
          const learnedHeaders = new Headers(prelude.headers.map(([name, value]) => [name, value]))
          const forbidden = new Set(nonReplayableHeaders)
          for (const name of (headers.get('connection') ?? '').split(',')) {
            forbidden.add(name.trim().toLowerCase())
          }

          for (const name of config.headers.allowlist) {
            if (
              name !== 'cache-control' &&
              !forbidden.has(name) &&
              headers.get(name) !== learnedHeaders.get(name)
            ) {
              await mismatch('header-mismatch')
            }
          }
        }

        // Capture only bounded HTML prefixes while learning. HEAD and redirect samples retain
        // no body bytes, and successful hits do not collect samples or recompute safe boundaries.
        if (!prelude) {
          sampledResponse = await sampler.response(ticket, status, headers)
          if (cancelled) {
            return
          }
        }

        for await (const value of stream) {
          const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value)
          if (cancelled) {
            return
          }

          if (prelude) {
            // Compare only the overlap with the unverified prelude. Buffer views avoid copies
            // and decoding. After verification, length is zero and later chunks pass in full.
            const length = Math.min(chunk.length, prelude.prefix.length - prefixBytes)
            if (!chunk.subarray(0, length).equals(prelude.prefix.subarray(prefixBytes, prefixBytes + length))) {
              // Nothing from this chunk has been forwarded; already exposed bytes cannot be retracted.
              await mismatch('prefix-mismatch')
            }

            prefixBytes += length
            if (length < chunk.length) {
              // Forward a suffix view and yield to downstream demand. Chunks entirely within
              // the prelude require another read because they produce no output. There is no
              // concatenation or full-response buffering on the serving path.
              suffixBytes += chunk.length - length
              yield chunk.subarray(length)
            }
          } else {
            sampledResponse?.push(chunk)
            yield chunk
          }
        }
        if (cancelled) {
          return
        }

        if (prelude) {
          // EOF is valid only after every anticipated byte has been observed. A shorter
          // response contradicts the prelude even if all compared bytes matched.
          if (prefixBytes !== prelude.prefix.length) {
            await mismatch('short-body')
          }

          // A verified EOF requires no sample commit or storage update in the frozen state.
          emit(request, 'verified', { prefixBytes, suffixBytes })
        } else {
          // Commit only after complete consumption. Cancellation and source errors leave
          // partial samples uncommitted; generation checks reject stale in-flight learning.
          await sampledResponse?.complete()
        }
      } catch (cause) {
        // Preserve known application error codes and normalize unexpected stream failures.
        // Report the terminal event before cleanup; racing close callbacks cannot report it twice.
        const error = cause.code?.startsWith('PLT_GATEWAY_EARLY_FLUSH_')
          ? cause
          : new EarlyFlushUpstreamError('response stream', { cause })
        finish('failed', { code: error.code })
        throw error
      } finally {
        sampledResponse?.abort()

        // Release the owned source on normal EOF, mismatch, source failure or generator return.
        // If it has not arrived yet, the producer continuation owns its eventual cancellation cleanup.
        source?.destroy()
      }
    }

    try {
      const response = prelude ?? await pending.promise
      if (cancelled) {
        return reply
      }

      if (prelude) {
        // Prepared metadata describes uncompressed HTML, not the eventual upstream transport.
        // Its complete body length is not yet known. Earlier hooks may also have supplied
        // validators or encoding metadata for a different representation; discard those values.
        for (const name of [
          'content-length',
          'content-encoding',
          'etag',
          'content-md5',
          'digest',
          'content-digest',
          'repr-digest',
          'accept-ranges'
        ]) {
          if (reply.hasHeader(name)) {
            reply.removeHeader(name)
          }
        }

        // HTTP/1.1 framing must distinguish a truncated hit from successful EOF. Calling
        // removeHeader('transfer-encoding') would disable Node's automatic chunked framing.
        if (request.raw.httpVersionMajor === 1 && request.raw.httpVersionMinor >= 1) {
          reply.header('transfer-encoding', 'chunked')
        }
      }

      reply
        .code(prelude ? prelude.status : response.statusCode)
        .headers(prelude ? Object.fromEntries(prelude.headers) : response.headers)
        .header('x-early-flush', decision)

      // Use a byte-based high watermark rather than chunk-count buffering. The async generator
      // follows downstream demand with Node's bounded read-ahead; one chunk may exceed the watermark.
      output = Readable.from(body(prelude ? undefined : response), { objectMode: false, highWaterMark: 16384 })
      output.on('error', error => {
        request.log.warn({ err: ensureLoggableError(error) }, 'Early flush response failed')
      })

      // The gateway owns final compression and Fastify's response lifecycle. It compresses
      // the combined prefix/suffix stream once and flushes idle output before SSR completes.
      return send(request, reply, output)
    } catch (error) {
      source?.destroy()
      reply.raw.removeListener('close', cancel)
      reply.raw.removeListener('finish', completed)
      finish('failed', { code: error.code })

      if (!cancelled) {
        // Pre-header failures remain owned by Fastify's configured error handler.
        if (options.onError) {
          return options.onError(reply, { error })
        }
        throw error
      }
      return reply
    }
  }
}
