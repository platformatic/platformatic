'use strict'

const fp = require('fastify-plugin')

async function composeOpenAPI (app) {
  const onRouteHooks = {}

  app.addHook('onRoute', (routeOptions) => {
    const method = routeOptions.method
    const openApiPath = routeOptions.config?.openApiPath

    const onRouteHook = onRouteHooks[openApiPath]?.[method]
    if (onRouteHook) {
      onRouteHook(routeOptions)
    }
  })

  let isApplicationReady = false
  app.addHook('onReady', () => {
    isApplicationReady = true
  })

  app.decorate('addComposerOnRouteHook', function (openApiPath, methods, hook) {
    /* c8 ignore next 5 */
    if (isApplicationReady) {
      throw new Error(
        'Fastify instance is already listening. Cannot call "addComposerOnRouteHook"!'
      )
    }

    if (onRouteHooks[openApiPath] === undefined) {
      onRouteHooks[openApiPath] = {}
    }

    const routeHooks = onRouteHooks[openApiPath]

    for (let method of methods) {
      method = method.toUpperCase()

      // TODO: check if already exists
      routeHooks[method] = hook
    }
  })
}

module.exports = fp(composeOpenAPI)
