import { NodeCapability } from '@platformatic/node'
import { workerData } from 'node:worker_threads'

const getMeta = NodeCapability.prototype.getMeta

NodeCapability.prototype.getMeta = function () {
  if (workerData.applicationConfig.id === 'service' && workerData.worker.index === 0) {
    process.exit(0)
  }

  return getMeta.call(this)
}
