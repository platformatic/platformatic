'use strict'

const kConfig = Symbol.for('plt.runtime.config')
const kId = Symbol.for('plt.runtime.id') // This is also used to detect if we are running in a Platformatic runtime thread
const kFullId = Symbol.for('plt.runtime.fullId')
const kApplicationId = Symbol.for('plt.runtime.application.id')
const kWorkerId = Symbol.for('plt.runtime.worker.id')
const kITC = Symbol.for('plt.runtime.itc')
const kHealthCheckTimer = Symbol.for('plt.runtime.worker.healthCheckTimer')
const kWorkerStatus = Symbol('plt.runtime.worker.status')
const kInterceptors = Symbol.for('plt.runtime.worker.interceptors')
const kLastELU = Symbol.for('plt.runtime.worker.lastELU')

// This string marker should be safe to use since it belongs to Unicode private area
const kStderrMarker = '\ue002'

// Note that this is used to create a BroadcastChannel so it must be a string
const kWorkersBroadcast = 'plt.runtime.workers'

module.exports = {
  kConfig,
  kId,
  kFullId,
  kApplicationId,
  kWorkerId,
  kITC,
  kHealthCheckTimer,
  kLastELU,
  kWorkerStatus,
  kStderrMarker,
  kInterceptors,
  kWorkersBroadcast
}
