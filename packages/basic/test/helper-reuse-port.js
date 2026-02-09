import diagnosticChannel from 'node:diagnostics_channel'

diagnosticChannel.subscribe('http.server.response.created', ({ response }) => {
  response.setHeader('x-plt-worker-id', globalThis.platformatic.workerId)
})
