export default {
  getHeadersOverride () {
    return {
      request: { cookie: 'session=hook', 'x-upstream-host': 'from-the-hook' },
      response: { 'x-frame-options': 'SAMEORIGIN' }
    }
  }
}
