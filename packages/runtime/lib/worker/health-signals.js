import { getITC, updateGlobals } from '@platformatic/globals'
import { monitorEventLoopDelay } from 'node:perf_hooks'
import {
  HealthSignalMustBeObjectError,
  HealthSignalTypeMustBeStringError
} from '../errors.js'

export class HealthSignalsQueue {
  #size
  #values

  constructor (options = {}) {
    this.#size = options.size ?? 100
    this.#values = []
  }

  add (value) {
    if (Array.isArray(value)) {
      for (const v of value) {
        this.#values.push(v)
      }
    } else {
      this.#values.push(value)
    }
    if (this.#values.length > this.#size) {
      this.#values.splice(0, this.#values.length - this.#size)
    }
  }

  getAll () {
    const values = this.#values
    this.#values = []
    return values
  }
}

export function initHealthSignalsApi (options = {}) {
  const queue = new HealthSignalsQueue()
  const timeout = options.timeout ?? 1000
  const workerId = options.workerId

  let isSending = false
  let promise = null

  async function sendHealthSignal (signal) {
    if (typeof signal !== 'object') {
      throw new HealthSignalMustBeObjectError()
    }
    if (typeof signal.type !== 'string') {
      throw new HealthSignalTypeMustBeStringError(signal.type)
    }
    if (!signal.timestamp || typeof signal.timestamp !== 'number') {
      signal.timestamp = Date.now()
    }

    queue.add(signal)

    if (!isSending) {
      isSending = true
      promise = new Promise((resolve, reject) => {
        setTimeout(async () => {
          isSending = false
          try {
            const signals = queue.getAll()
            const itc = getITC()
            await itc.send('sendHealthSignals', {
              workerId,
              signals
            })
          } catch (err) {
            reject(err)
            return
          }
          resolve()
        }, timeout)
      })
    }

    return promise
  }

  updateGlobals({ sendHealthSignal })

  return sendHealthSignal
}

// Samples the event loop delay and reports it as an eventLoopDelay health
// signal once per second, in milliseconds. The measurement must run inside
// the worker (monitorEventLoopDelay is per-isolate, there is no cross-thread
// equivalent): during a hard block nothing is reported and a sample with a
// large max arrives once the loop unblocks — full blocks are already caught
// by the main-thread measured ELU, this signal catches long individual
// stalls at low average utilization, which are invisible to any ELU
// threshold.
export function startEventLoopDelayMonitor (sendHealthSignal, options = {}) {
  const histogram = monitorEventLoopDelay({ resolution: options.resolution ?? 20 })
  histogram.enable()

  const interval = setInterval(() => {
    // With one-second windows the p99 is close to the max (few dozen samples
    // per window), but it smooths single outliers on consumers that prefer it
    const max = histogram.max / 1e6
    const mean = histogram.mean / 1e6
    const p99 = histogram.percentile(99) / 1e6
    histogram.reset()

    // Signals are delivered on a best-effort basis
    sendHealthSignal({ type: 'eventLoopDelay', max, mean, p99 }).catch(() => {})
  }, options.interval ?? 1000)
  interval.unref()

  return function stopEventLoopDelayMonitor () {
    clearInterval(interval)
    histogram.disable()
  }
}
