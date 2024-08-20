'use strict'

const defaultStackable = {
  init: () => {},
  start: () => {
    throw new Error('Stackable start not implemented')
  },
  stop: () => {},
  getUrl: () => null,
  updateContext: () => {},
  getConfig: () => null,
  getInfo: () => null,
  getDispatchFunc: () => null,
  getOpenapiSchema: () => null,
  getDBInfo: () => null,
  getGraphqlSchema: () => null,
  getMetrics: () => null,
  inject: () => {
    throw new Error('Stackable inject not implemented')
  },
  log: ({ message }) => {
    console.log(message)
  },
  getBootstrapDependencies: () => [],
  getWatchConfig: () => ({ enabled: false }),
}

module.exports = defaultStackable
