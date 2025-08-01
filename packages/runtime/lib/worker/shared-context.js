'use strict'

const { kITC } = require('./symbols')

class SharedContext {
  constructor () {
    this.sharedContext = null
  }

  update (context, options = {}) {
    return globalThis[kITC].send('updateSharedContext', { ...options, context })
  }

  get () {
    if (this.sharedContext === null) {
      this.sharedContext = globalThis[kITC].send('getSharedContext')
    }
    return this.sharedContext
  }

  _set (context) {
    this.sharedContext = context
  }
}

module.exports = { SharedContext }
