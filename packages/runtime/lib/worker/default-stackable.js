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
  getOpenapiSchema: () => null,
  getGraphqlSchema: () => null,
  getMeta: () => ({}),
  collectMetrics: () => {},
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
