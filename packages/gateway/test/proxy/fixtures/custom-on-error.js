export default {
  getUpstream () {
    // Point to a port which is guaranteed to be closed
    return globalThis.customProxyUnreachableUpstream
  },
  onError (reply, { error }) {
    reply.code(503).send({ handled: true, code: error.code ?? null })
  }
}
