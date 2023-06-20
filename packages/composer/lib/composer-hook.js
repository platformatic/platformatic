'use strict'

const fp = require('fastify-plugin')

async function composeOpenAPI (app) {
  const onRoutesHooks = {}

  app.addHook('onRoute', (routeOptions) => {
    const method = routeOptions.method
    const openApiPath = routeOptions.config?.openApiPath

    const onRouteHooks = onRoutesHooks[openApiPath]?.[method]
    if (Array.isArray(onRouteHooks)) {
      for (const onRouteHook of onRouteHooks) {
        onRouteHook(routeOptions)
      }
    }
  })

  let isApplicationReady = false
  app.addHook('onReady', () => {
    isApplicationReady = true
  })

  function addComposerOnRouteHook (openApiPath, methods, hook) {
    /* c8 ignore next 5 */
    if (isApplicationReady) {
      throw new Error(
        'Fastify instance is already listening. Cannot call "addComposerOnRouteHook"!'
      )
    }

    if (onRoutesHooks[openApiPath] === undefined) {
      onRoutesHooks[openApiPath] = {}
    }

    const routeHooks = onRoutesHooks[openApiPath]

    for (let method of methods) {
      method = method.toUpperCase()

      if (routeHooks[method] === undefined) {
        routeHooks[method] = []
      }
      routeHooks[method].push(hook)
    }
  }

  Object.defineProperty(app.platformatic, 'addComposerOnRouteHook', {
    value: addComposerOnRouteHook,
    writable: false,
    configurable: false
  })
}

module.exports = fp(composeOpenAPI)
