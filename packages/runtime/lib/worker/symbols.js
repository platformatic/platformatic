export const kConfig = Symbol.for('plt.runtime.config')
export const kId = Symbol.for('plt.runtime.id') // This is also used to detect if we are running in a Platformatic runtime thread
export const kFullId = Symbol.for('plt.runtime.fullId')
export const kApplicationId = Symbol.for('plt.runtime.application.id')
export const kWorkerId = Symbol.for('plt.runtime.worker.id')
export const kITC = Symbol.for('plt.runtime.itc')
export const kController = Symbol.for('plt.runtime.controller')
export const kHealthCheckTimer = Symbol.for('plt.runtime.worker.healthCheckTimer')
export const kWorkerStatus = Symbol.for('plt.runtime.worker.status')
export const kInterceptors = Symbol.for('plt.runtime.worker.interceptors')
export const kLastELU = Symbol.for('plt.runtime.worker.lastELU')

// This string marker should be safe to use since it belongs to Unicode private area
export const kStderrMarker = '\ue002'

// Note that this is used to create a BroadcastChannel so it must be a string
export const kWorkersBroadcast = 'plt.runtime.workers'
