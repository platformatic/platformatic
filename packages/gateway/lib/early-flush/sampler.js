import { randomUUID } from 'node:crypto'
import { DynamicBuffer } from '@platformatic/dynamic-buffer'
import { compareSample } from './comparer.js'
import { nonReplayableHeaders } from './headers.js'
import { MemoryStorage } from './storage/memory.js'

/** Bounded prefix capture. A sample is committed only after the adapter confirms completion. */
export class SampledResponse {
  #sampler
  #ticket
  #sample
  #limit
  #buffer
  #finished

  constructor (sampler, ticket, sample, limit) {
    this.#sampler = sampler
    this.#ticket = ticket
    this.#sample = sample
    this.#limit = sample.kind === 'html' ? limit : 0
    this.#buffer = new DynamicBuffer()
    this.#finished = false
  }

  push (chunk) {
    if (this.#finished || this.#buffer.length >= this.#limit) {
      return
    }

    const prefix = chunk.subarray(0, this.#limit - this.#buffer.length)
    // Copy only the retained bytes; a slice must not pin a whole response buffer.
    this.#buffer.append(Buffer.from(prefix))
  }

  abort () {
    this.#finished = true
    this.#buffer.consume(this.#buffer.length)
  }

  async complete () {
    if (this.#finished) {
      return
    }

    this.#finished = true
    this.#sample.prefix = this.#buffer.buffer
    this.#buffer.consume(this.#buffer.length)

    await this.#sampler.commit(this.#ticket, this.#sample)
  }
}

export class Sampler {
  #options

  constructor (options) {
    this.#options = options
    this.storage = options.storage ?? new MemoryStorage(options.memory)
    // Optional calls at emission sites avoid constructing event objects when diagnostics are off.
    const callback = options.onEarlyFlushEvent
    if (callback) {
      this.onEvent = event => {
        try {
          callback(event)
        } catch {}
      }
    }
  }

  report (error) {
    // Diagnostics must not turn an optional sampling failure into a response failure.
    try {
      if (this.#options.onSamplingError) {
        this.#options.onSamplingError(error)
      } else {
        console.error('early-flush sampling failed', error)
      }
    } catch {}
  }

  /**
   * The gateway has already matched a route and resolved the native-request key.
   * Returns an admitted ticket for learning or serving, or a bypass with its reason.
   */
  async begin (request, key) {
    if (!this.#options.methods.some(method => method === request.method)) {
      return { result: 'bypass', reason: 'method' }
    }
    if (request.headers.has('range')) {
      return { result: 'bypass', reason: 'range' }
    }
    for (const name of request.headers.keys()) {
      if (name.startsWith('if-')) {
        return { result: 'bypass', reason: 'conditional' }
      }
    }

    try {
      if (key === null) {
        return { result: 'bypass', reason: 'resolver' }
      }

      return {
        result: 'admitted',
        ticket: {
          key,
          generation: await this.storage.acquire(key, randomUUID, this.#options.windowSize),
          request
        }
      }
    } catch (error) {
      this.report(error)
      return { result: 'bypass', reason: 'sampling-error' }
    }
  }

  /** Checks response eligibility without allocating a sample or retaining body bytes. */
  async eligible (ticket, status, headers) {
    // Redirects are evidence against early flushing, even without usable HTML.
    // A 304 is a cache-validation response; errors and other statuses provide no sample.
    const redirect = status >= 300 && status < 400 && status !== 304
    if (!redirect && (status < 200 || status >= 300)) {
      return false
    }

    // HEAD contributes metadata only. For other successful responses, require HTML
    // representing a full document rather than a bodyless status or a partial range.
    const head = ticket.request.method === 'HEAD'
    if (!redirect && !head) {
      if (
        status === 204 ||
        status === 205 ||
        status === 206 ||
        headers.has('content-range') ||
        headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'text/html'
      ) {
        return false
      }

      // The gateway requests identity upstream and owns output compression separately.
      const encoding = headers.get('content-encoding')?.trim().toLowerCase()
      if (encoding && encoding !== 'identity') {
        return false
      }
    }

    // Session cookies and CSP nonces make replay unsafe by default. Redirects bypass
    // these exclusions so an authentication redirect setting cookies is still sampled.
    if (!redirect) {
      if (this.#options.headers.excludeSetCookie && headers.has('set-cookie')) {
        return false
      }
      if (this.#options.headers.excludeCspNonce && /'nonce-/i.test(headers.get('content-security-policy') ?? '')) {
        return false
      }

      // Variants may share a key only when the custom resolver accounts for them.
      // Accept-Encoding is reserved for compression handling; Vary: * cannot be covered.
      const vary = (headers.get('vary') ?? '')
        .split(',')
        .map(name => name.trim().toLowerCase())
        .filter(Boolean)
      if (
        vary.some(
          name => name === '*' || (name !== 'accept-encoding' && !this.#options.headers.keyHeaders.includes(name))
        )
      ) {
        return false
      }
    }

    // The application filter can further restrict any sample, including redirects.
    // Filter failures skip sampling rather than fail the application response.
    try {
      if (
        this.#options.isResponseEligible &&
        !(await this.#options.isResponseEligible({ request: ticket.request, status, headers }))
      ) {
        return false
      }
    } catch (error) {
      this.report(error)
      return false
    }

    return true
  }

  /** Creates a bounded collector only while learning, or to record a completed redirect. */
  async response (ticket, status, headers) {
    if (!(await this.eligible(ticket, status, headers))) {
      return undefined
    }

    const redirect = status >= 300 && status < 400 && status !== 304
    const head = ticket.request.method === 'HEAD'
    const sample = {
      kind: redirect ? 'redirect' : head ? 'head' : 'html',
      status,
      headers: [],
      prefix: new Uint8Array()
    }

    // Keep only replay candidates; never retain cookies or transport headers in learned state.
    const forbidden = new Set(nonReplayableHeaders)
    // Connection can nominate additional hop-by-hop fields beyond the standard list.
    for (const name of (headers.get('connection') ?? '').split(',')) {
      forbidden.add(name.trim().toLowerCase())
    }

    // An explicit allowlist never overrides exclusions for cookies and transport metadata.
    // Missing headers remain absent so later analysis can distinguish them from empty values.
    for (const name of this.#options.headers.allowlist) {
      const value = headers.get(name)
      if (value !== null && !forbidden.has(name)) {
        sample.headers.push([name, value])
      }
    }

    // The collector bounds retained HTML bytes and keeps HEAD/redirect prefixes empty.
    return new SampledResponse(this, ticket, sample, this.#options.maxPrefixBytes)
  }

  async commit (ticket, sample) {
    try {
      let promoted
      const accessed = await this.storage.access(ticket.key, ticket.generation, state => {
        // A CAS retry must replace diagnostics from its discarded attempt.
        promoted = undefined
        // Requests that started learning before promotion may finish after it. Freeze their
        // updates at the atomic boundary too; redirects must still apply their suspension policy.
        if (!state.prelude || sample.kind === 'redirect') {
          const previous = state.prelude
          compareSample(state, sample, this.#options)
          if (!previous && state.prelude && this.onEvent) {
            promoted = {
              type: 'promoted',
              prefixBytes: state.prelude.prefix.byteLength,
              status: state.prelude.status,
              sampleCount: state.samples.size
            }
          }
        }
      })
      // Invoke user code only after the storage transaction has succeeded.
      if (accessed && promoted) {
        this.onEvent?.(promoted)
      }
    } catch (error) {
      this.report(error)
    }
  }

  /**
   * Read through the atomic boundary so a stale ticket cannot select a newer generation's prelude.
   * Returns a hit with its prelude, a miss (including stale tickets), or a bypass on storage failure.
   */
  async prelude (ticket) {
    let prelude
    try {
      await this.storage.access(ticket.key, ticket.generation, state => {
        prelude = state.prelude
      })
    } catch (error) {
      this.report(error)
      return { result: 'bypass', reason: 'sampling-error' }
    }
    return prelude ? { result: 'hit', prelude } : { result: 'miss' }
  }

  async invalidate (ticket, reason) {
    try {
      if (await this.storage.invalidate(ticket.key, ticket.generation)) {
        this.onEvent?.({ type: 'invalidated', reason })
      }
    } catch (error) {
      this.report(error)
    }
  }
}
