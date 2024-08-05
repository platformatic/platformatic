'use strict'

const kConfig = Symbol.for('plt.runtime.config')
const kId = Symbol.for('plt.runtime.id') // This is also used to detect if we are running in a Platformatic runtime thread
const kITC = Symbol.for('plt.runtime.itc')

module.exports = { kConfig, kId, kITC }
