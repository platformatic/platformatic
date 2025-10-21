import {
  HealthSignalMustBeObjectError,
  HealthSignalTypeMustBeStringError
} from '../errors.js'

class HealthSignalsQueue {
  #size
  #values

  constructor (options = {}) {
    this.#size = options.size ?? 100
    this.#values = []
  }

  add (value) {
    this.#values.push(value)
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
  const applicationId = options.applicationId

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

    signal.workerId = workerId
    signal.application = applicationId

    queue.add(signal)

    if (!isSending) {
      isSending = true
      promise = new Promise((resolve, reject) => {
        setTimeout(async () => {
          isSending = false
          try {
            const signals = queue.getAll()
            await globalThis.platformatic.itc.send('sendHealthSignals', { signals })
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

  globalThis.platformatic.sendHealthSignal = sendHealthSignal
}
