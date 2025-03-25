'use strict'

const { resourceLimits } = require('node:worker_threads')
const v8 = require('node:v8')

module.exports = async function (app) {
  app.get('/', async () => {
    return {
      resourceLimits,
      heapStatistics: v8.getHeapStatistics(),
      heapSpaceStatistics: v8.getHeapSpaceStatistics(),
    }
  })
}
