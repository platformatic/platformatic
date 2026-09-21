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

  _set (context) {
    this.sharedContext = context
  }
}
