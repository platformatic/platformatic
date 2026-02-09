'use strict'

const { DecoratorHandler } = require('undici')

const createTestInterceptor = (interceptorOptions = {}) => {
  const { testInterceptedValue } = interceptorOptions

  return dispatch => {
    class ResultInterceptor extends DecoratorHandler {
      onResponseStart (ac, statusCode, headers) {
        headers['x-res-intercepted'] = 'true'
        return super.onResponseStart(ac, statusCode, headers)
      }
    }

    return function InterceptedDispatch (opts, handler) {
      opts.headers = {
        ...opts.headers,
        'x-req-intercepted': 'true',
        'x-req-intercepted-value': testInterceptedValue
      }
      return dispatch(opts, new ResultInterceptor(handler))
    }
  }
}

module.exports = createTestInterceptor
