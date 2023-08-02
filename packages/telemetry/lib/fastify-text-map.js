'use strict'

const fastifyTextMapGetter = {
  get (request, key) {
    return request.headers[key]
  },
  /* istanbul ignore next */
  keys (request) {
    return Object.keys(request.headers)
  }
}

const fastifyTextMapSetter = {
  set (reply, key, value) {
    reply.headers({ [key]: value })
  }
}

module.exports = {
  fastifyTextMapGetter,
  fastifyTextMapSetter
}
