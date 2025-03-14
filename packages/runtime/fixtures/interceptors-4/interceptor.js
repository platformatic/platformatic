'use strict'

const createTestInterceptor = () => {
  return dispatch => {
    return function InterceptedDispatch (opts, handler) {
      opts.headers = {
        ...opts.headers,
        'x-req-intercepted': 'true'
      }
      return dispatch(opts, handler)
    }
  }
}

module.exports = createTestInterceptor
