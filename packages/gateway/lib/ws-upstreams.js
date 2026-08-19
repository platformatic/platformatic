import { getITC } from '@platformatic/globals'
import { setTimeout as sleep } from 'node:timers/promises'

export const REFRESH_ATTEMPTS = 5
export const REFRESH_RETRY_DELAY = 200

// Tracks the TCP upstream of local applications so that WebSocket upgrades are
// always dialed against a live worker: workers bind a new ephemeral port on
// every (re)start, so the URL captured at plugin registration time would leave
// the gateway dialing a dead port after a crash or a restart.
export class WsUpstreams {
  #logger
  #urls
  #itc
  #handler
  #inflight

  constructor (logger) {
    this.#logger = logger
    this.#urls = new Map()
    this.#inflight = new Set()
  }

  track (applicationId, url) {
    this.#urls.set(applicationId, url)
    this.#subscribe()
  }

  get (applicationId) {
    return this.#urls.get(applicationId)
  }

  close () {
    if (this.#handler) {
      this.#itc.removeListener('runtime:event', this.#handler)
      this.#handler = null
    }
  }

  #subscribe () {
    if (this.#handler) {
      return
    }

    // When there is no ITC the gateway is running outside a runtime, so there
    // are no workers which could restart and the tracked URLs cannot go stale.
    const itc = getITC({ throwOnMissing: false })
    if (!itc) {
      return
    }

    this.#itc = itc
    this.#handler = ({ event, payload }) => {
      // emitAndNotify forwards the event arguments as an array
      const eventPayload = payload?.[0]
      const applicationId = eventPayload?.application

      if (!this.#urls.has(applicationId)) {
        return
      }

      if (event === 'application:worker:started') {
        // Target the worker which just started: querying the application in
        // round-robin mode could hit a worker which is about to be replaced
        // and thus capture a stale URL.
        this.#refresh(applicationId, eventPayload.worker)
      } else if (event === 'application:worker:stopped' || event === 'application:worker:exited') {
        // Re-resolve over the surviving workers to correct any URL captured
        // from the worker which just went away. A single graceful stop emits
        // both events: the in-flight guard in #refresh coalesces them.
        this.#refresh(applicationId)
      }
    }

    itc.on('runtime:event', this.#handler)
  }

  async #refresh (applicationId, workerId) {
    const target = workerId == null ? applicationId : `${applicationId}:${workerId}`

    if (this.#inflight.has(target)) {
      return
    }

    this.#inflight.add(target)

    try {
      // The event may be delivered while the target worker is not addressable
      // yet, so retry a few times before giving up.
      for (let attempt = 0; attempt < REFRESH_ATTEMPTS; attempt++) {
        try {
          const allMeta = await this.#itc.send('getApplicationMeta', target)
          const url = (allMeta.gateway ?? allMeta.composer)?.url

          if (url) {
            this.#logger.debug({ applicationId, url }, 'ws upstream refreshed')
            this.#urls.set(applicationId, url)
            return
          }
        } catch (err) {
          // The worker is not addressable yet, retry below.
          this.#logger.debug({ applicationId, target, err: err.message }, 'ws upstream refresh attempt failed')
        }

        await sleep(REFRESH_RETRY_DELAY)
      }
    } finally {
      this.#inflight.delete(target)
    }

    if (workerId == null) {
      // After a worker went away, finding no addressable worker is expected when
      // the application was stopped for good: the next worker start triggers a
      // new refresh, so this is only noteworthy at debug level.
      this.#logger.debug(
        `Could not refresh the WebSocket upstream of the "${applicationId}" application: no addressable worker. The upstream will be refreshed on the next worker start.`
      )
    } else {
      this.#logger.warn(
        `Could not refresh the WebSocket upstream of the "${applicationId}" application. New WebSocket connections may be dialed against a stale TCP port.`
      )
    }
  }
}
