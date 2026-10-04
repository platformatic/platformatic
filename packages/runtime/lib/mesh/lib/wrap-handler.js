/* c8 ignore start */

'use strict'

class WrapHandler {
  #handler

  constructor (handler) {
    this.#handler = handler
  }

  onRequestStart (controller, context) {
    this.#handler.onConnect?.(err => controller.abort(err), context)
  }

  onResponseStart (controller, statusCode, headers, statusMessage) {
    const rawHeaders = []
    for (const [key, val] of Object.entries(headers)) {
      rawHeaders.push(Buffer.from(key), Buffer.from(val))
    }

    this.#handler.onHeaders?.(statusCode, rawHeaders, () => {}, statusMessage)
  }

  onResponseData (controller, data) {
    this.#handler.onData?.(data)
  }

  onResponseEnd () {
    this.#handler.onComplete?.([])
  }

  // TODO(mcollina): I do not know how to trigger these
  /* c8 ignore next 3 */
  onResponseError (controller, err) {
    this.#handler.onError?.(err)
  }
}

module.exports = { WrapHandler }

/* c8 ignore stop */
