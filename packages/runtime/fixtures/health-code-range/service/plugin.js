import { resourceLimits } from 'node:worker_threads'
import v8 from 'node:v8'

export default async function (app) {
  app.get('/', async () => {
    return {
      resourceLimits,
      heapStatistics: v8.getHeapStatistics(),
      heapSpaceStatistics: v8.getHeapSpaceStatistics(),
    }
  })
}
