'use strict'

const { setTimeout: sleep } = require('node:timers/promises')
const { Unpromise } = require('@watchable/unpromise')

const kTimeout = Symbol('plt.utils.timeout')

async function executeWithTimeout (promise, timeout, timeoutValue = kTimeout) {
  const ac = new AbortController()

  return Unpromise.race([promise, sleep(timeout, timeoutValue, { signal: ac.signal, ref: false })]).then(value => {
    ac.abort()
    return value
  })
}

module.exports = { executeWithTimeout, kTimeout }
