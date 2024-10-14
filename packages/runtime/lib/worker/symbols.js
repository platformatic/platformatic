'use strict'

const kConfig = Symbol.for('plt.runtime.config')
const kId = Symbol.for('plt.runtime.id') // This is also used to detect if we are running in a Platformatic runtime thread
const kITC = Symbol.for('plt.runtime.itc')
const kLoggerDestination = Symbol.for('plt.runtime.loggerDestination')
const kLoggingPort = Symbol.for('plt.runtime.logginPort')
const kWorkerStatus = Symbol('plt.runtime.worker.status')

module.exports = { kConfig, kId, kITC, kLoggerDestination, kLoggingPort, kWorkerStatus }
