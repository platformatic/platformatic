'use strict'

const createTestInterceptor = () => {
  const testInterceptor = (dispatch) => {
    return function InterceptedDispatch (opts, handler) {
      opts.headers = { ...opts.headers, intercepted: 'true' }
      return dispatch(opts, handler)
    }
  }
  return testInterceptor
}

module.exports = createTestInterceptor
