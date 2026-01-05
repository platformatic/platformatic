export const fastifyTextMapGetter = {
  get (request, key) {
    return request.headers[key]
  },
  /* istanbul ignore next */
  keys (request) {
    return Object.keys(request.headers)
  }
}

export const fastifyTextMapSetter = {
  set (reply, key, value) {
    reply.header(key, value)
  }
}
