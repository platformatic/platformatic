'use strict'

const kConfig = Symbol.for('plt.runtime.config')
const kId = Symbol.for('plt.runtime.id') // This is also used to detect if we are running in a Platformatic runtime thread
const kServiceId = Symbol.for('plt.runtime.service.id')
const kWorkerId = Symbol.for('plt.runtime.worker.id')
const kITC = Symbol.for('plt.runtime.itc')
const kLoggerDestination = Symbol.for('plt.runtime.loggerDestination')
const kLoggingPort = Symbol.for('plt.runtime.logginPort')
const kWorkerStatus = Symbol('plt.runtime.worker.status')

module.exports = { kConfig, kId, kServiceId, kWorkerId, kITC, kLoggerDestination, kLoggingPort, kWorkerStatus }
