'use strict'

const kConfig = Symbol.for('plt.runtime.config')
const kId = Symbol.for('plt.runtime.id') // This is also used to detect if we are running in a Platformatic runtime thread
const kFullId = Symbol.for('plt.runtime.fullId')
const kServiceId = Symbol.for('plt.runtime.service.id')
const kWorkerId = Symbol.for('plt.runtime.worker.id')
const kITC = Symbol.for('plt.runtime.itc')
const kHealthCheckTimer = Symbol.for('plt.runtime.worker.healthCheckTimer')
const kWorkerStatus = Symbol('plt.runtime.worker.status')
const kInterceptors = Symbol.for('plt.runtime.worker.interceptors')

// This string marker should be safe to use since it belongs to Unicode private area
const kStderrMarker = '\ue002'

module.exports = {
  kConfig,
  kId,
  kFullId,
  kServiceId,
  kWorkerId,
  kITC,
  kHealthCheckTimer,
  kWorkerStatus,
  kStderrMarker,
  kInterceptors
}
