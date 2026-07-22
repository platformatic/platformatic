import { getITC } from '@platformatic/globals'

export class SharedContext {
  constructor () {
    this.sharedContext = null
  }

  update (context, options = {}) {
    const itc = getITC()
    return itc.send('updateSharedContext', { ...options, context })
  }

  get () {
    if (this.sharedContext === null) {
      const itc = getITC()
      this.sharedContext = itc.send('getSharedContext')
    }
    return this.sharedContext
  }

  // The context as it stands, without awaiting. get() caches a promise on its
  // first call, so only an already-delivered context is readable here; callers
  // that cannot await (a diagnostics channel subscriber, for one) get null until
  // the first update arrives.
  getSync () {
    if (this.sharedContext === null || typeof this.sharedContext.then === 'function') {
      return null
    }
    return this.sharedContext
  }

  _set (context) {
    this.sharedContext = context
  }
}
