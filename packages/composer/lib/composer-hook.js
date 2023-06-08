'use strict'

const fp = require('fastify-plugin')

async function composeOpenAPI (app) {
  const routesOptions = {}

  app.addHook('onRoute', (routeOptions) => {
    const method = routeOptions.method
    const openApiPath = routeOptions.config?.openApiPath

    if (routesOptions[method] === undefined) {
      routesOptions[method] = {}
    }

    if (openApiPath) {
      routesOptions[method][openApiPath] = routeOptions
    }
  })

  let isApplicationReady = false
  app.addHook('onReady', () => {
    isApplicationReady = true
  })

  app.decorate('addComposerOnRouteHook', function (openApiPath, methods, hook) {
    if (isApplicationReady) {
      throw new Error(
        'Fastify instance is already listening. Cannot call "addComposerOnRouteHook"!'
      )
    }

    for (let method of methods) {
      method = method.toUpperCase()

      const routeOptions = routesOptions[method]?.[openApiPath]
      if (routeOptions) hook(routeOptions)
    }
  })
}

module.exports = fp(composeOpenAPI)
