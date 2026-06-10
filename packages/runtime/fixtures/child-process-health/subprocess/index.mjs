import { getApplicationId, getLogLevel, getWorkerId } from '@platformatic/globals'
import fastify from 'fastify'
import v8 from 'node:v8'

// Allocate ~50MB of V8 heap memory so health metrics can distinguish
// this child process from the coordinator worker thread
const data = []
for (let i = 0; i < 500000; i++) {
  data.push({ index: i, value: 'x'.repeat(50) })
}
globalThis.__keepAlive = data

const app = fastify({
  logger: {
    name: [getApplicationId(), getWorkerId()]
      .filter(f => typeof f !== 'undefined')
      .join(':'),
    level: getLogLevel(false) ?? 'info'
  }
})

app.get('/hello', async () => {
  return { from: 'subprocess' }
})

app.get('/heap-limit', async () => {
  const stats = v8.getHeapStatistics()
  return { heapSizeLimit: stats.heap_size_limit }
})

app.listen({ port: 0 })
