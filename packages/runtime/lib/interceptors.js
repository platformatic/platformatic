'use strict'

const { pathToFileURL } = require('node:url')

async function loadInterceptor (_require, module, options) {
  const url = pathToFileURL(_require.resolve(module))
  const interceptor = (await import(url)).default
  return interceptor(options)
}

function loadInterceptors (_require, interceptors) {
  return Promise.all(interceptors.map(async ({ module, options }) => {
    return loadInterceptor(_require, module, options)
  }))
}

module.exports = loadInterceptors
