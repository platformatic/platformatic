import { parentPort, workerData } from 'node:worker_threads'
import { createServer } from 'undici-thread-interceptor'

const server = createServer({
  meshId: workerData.meshId,
  serverId: 'service',
  domain: 'service.plt.local',
  server: `http://127.0.0.1:${workerData.port}`
})

server.ready.then(() => parentPort.postMessage('ready')).catch(error => parentPort.postMessage({ error }))
