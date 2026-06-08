import { getWorkerId } from '@platformatic/globals'
import diagnosticChannel from 'node:diagnostics_channel'

diagnosticChannel.subscribe('http.server.response.created', ({ response }) => {
  response.setHeader('x-plt-worker-id', getWorkerId())
})
