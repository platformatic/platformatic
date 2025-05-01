'use strict'

const defaultStackable = {
  init: () => {},
  start: () => {
    throw new Error('Stackable start not implemented')
  },
  stop: () => {},
  build: () => {},
  getUrl: () => null,
  updateContext: () => {},
  getConfig: () => null,
  getEnv: () => null,
  getInfo: () => null,
  getDispatchFunc: () => null,
  getDispatchTarget: () => null,
  getOpenapiSchema: () => null,
  getGraphqlSchema: () => null,
  getCustomHealthCheck: () => null,
  getCustomReadinessCheck: () => null,
  getMeta: () => ({}),
  getMetrics: () => null,
  inject: () => {
    throw new Error('Stackable inject not implemented')
  },
  log: ({ message }) => {
    console.log(message)
  },
  getBootstrapDependencies: () => [],
  getWatchConfig: () => ({ enabled: false })
}

module.exports = defaultStackable
