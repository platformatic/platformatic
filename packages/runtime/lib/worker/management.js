import { kITC } from './symbols.js'

export class ManagementClient {
  #allowedOperations

  constructor (allowedOperations) {
    this.#allowedOperations = allowedOperations
      ? new Set(allowedOperations)
      : null
  }

  #send (operation, data) {
    if (this.#allowedOperations && !this.#allowedOperations.has(operation)) {
      throw new Error(`Operation "${operation}" is not allowed`)
    }

    return globalThis[kITC].send('management:' + operation, data)
  }

  getRuntimeStatus () {
    return this.#send('getRuntimeStatus')
  }

  getRuntimeMetadata () {
    return this.#send('getRuntimeMetadata')
  }

  getRuntimeConfig () {
    return this.#send('getRuntimeConfig')
  }

  getRuntimeEnv () {
    return this.#send('getRuntimeEnv')
  }

  getApplicationsIds () {
    return this.#send('getApplicationsIds')
  }

  getApplications () {
    return this.#send('getApplications')
  }

  getWorkers () {
    return this.#send('getWorkers')
  }

  getApplicationDetails (id) {
    return this.#send('getApplicationDetails', { id })
  }

  getApplicationConfig (id) {
    return this.#send('getApplicationConfig', { id })
  }

  getApplicationEnv (id) {
    return this.#send('getApplicationEnv', { id })
  }

  getApplicationOpenapiSchema (id) {
    return this.#send('getApplicationOpenapiSchema', { id })
  }

  getApplicationGraphqlSchema (id) {
    return this.#send('getApplicationGraphqlSchema', { id })
  }

  getMetrics (format) {
    return this.#send('getMetrics', { format })
  }

  startApplication (id) {
    return this.#send('startApplication', { id })
  }

  stopApplication (id) {
    return this.#send('stopApplication', { id })
  }

  restartApplication (id) {
    return this.#send('restartApplication', { id })
  }

  restart (applications) {
    return this.#send('restart', { applications })
  }

  addApplications (applications, start) {
    return this.#send('addApplications', { applications, start })
  }

  removeApplications (ids) {
    return this.#send('removeApplications', { ids })
  }

  inject (id, injectParams) {
    return this.#send('inject', { id, injectParams })
  }
}
