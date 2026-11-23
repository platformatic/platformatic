import { parentPort, workerData } from 'node:worker_threads'
import { createServer } from 'undici-thread-interceptor'

function app (request, response) {
  if (request.url === '/error') {
    response.statusCode = 500
  }

  // Echo the headers so that the test can verify the propagated trace context.
  response.setHeader('content-type', 'application/json')
  response.end(JSON.stringify(request.headers))
}

const server = createServer({
  meshId: workerData.meshId,
  coordinatorThreadId: workerData.coordinatorThreadId,
  domain: 'myserver.local',
  server: app
})

await server.ready
parentPort.postMessage({ ready: true })
