'use strict'

const { join } = require('node:path')
const { readFile } = require('node:fs/promises')
const deepClone = require('rfdc')({ proto: true })
const compareOpenApiSchemas = require('openapi-schema-diff')
const fp = require('fastify-plugin')
const {
  changeOpenapiSchemaPrefix,
  convertOpenApiToFastifyPath
} = require('../utils')

const wrapperPath = join(__dirname, 'sandbox-wrapper.js')

const Swagger = require('@fastify/swagger')

async function loadVersions (app) {
  const configManager = app.platformatic.configManager
  const config = configManager.current

  const versions = config.versions ?? {}
  const versionsConfigs = versions.configs ?? []

  const latestVersionConfig = versionsConfigs.at(-1)
  const latestVersion = latestVersionConfig.version
  const latestVersionPrefix = latestVersionConfig.openapi.prefix ?? ''

  const latestVersionPlugin = fp(async function (app) {
    app.register(Swagger, {
      exposeRoute: true,
      openapi: {
        info: {
          title: 'Platformatic',
          description: 'This is a service built on top of Platformatic',
          version: latestVersion
        }
      },
      refResolver: {
        buildLocalReference (json, baseUri, fragment, i) {
          /* istanbul ignore next */
          return json.$id || `def-${i}`
        }
      }
    })

    app.register(SwaggerUI, {
      logLevel: 'warn',
      prefix: '/documentation'
    })

    if (latestVersionConfig.plugins) {
      await app.register(require(wrapperPath), latestVersionConfig.plugins)
    }
  }, {
    name: latestVersion,
    encapsulate: true
  })

  await app.register(latestVersionPlugin, {
    prefix: latestVersionPrefix
  })

  const latestOpenapiSchemaPath = latestVersionConfig.openapi.path
  const latestOpenapiSchemaFile = await readFile(latestOpenapiSchemaPath, 'utf8')
  const latestOpenapiSchema = JSON.parse(latestOpenapiSchemaFile)

  let nextVersionPrefix = latestVersionPrefix
  let nextNormalizedOpenapiSchema = changeOpenapiSchemaPrefix(
    latestOpenapiSchema,
    latestVersionConfig.openapi.prefix,
    ''
  )

  for (let i = versionsConfigs.length - 2; i >= 0; i--) {
    const prevVersionConfig = versionsConfigs[i]
    const prevVersion = prevVersionConfig.version
    const prevVersionPrefix = prevVersionConfig.openapi.prefix ?? ''
    const prevOpenapiSchemaPath = prevVersionConfig.openapi.path

    const prevOpenapiSchemaFile = await readFile(prevOpenapiSchemaPath, 'utf8')
    const prevOpenapiSchema = JSON.parse(prevOpenapiSchemaFile)

    const prevNormalizedOpenapiSchema = changeOpenapiSchemaPrefix(
      prevOpenapiSchema,
      prevVersionConfig.openapi.prefix,
      ''
    )

    const schemaDiff = compareOpenApiSchemas(
      prevNormalizedOpenapiSchema,
      nextNormalizedOpenapiSchema
    )

    const versionPlugin = fp(async function (app) {
      app.register(Swagger, {
        exposeRoute: true,
        openapi: {
          info: {
            title: 'Platformatic',
            description: 'This is a service built on top of Platformatic',
            version: prevVersion
          }
        },
        refResolver: {
          buildLocalReference (json, baseUri, fragment, i) {
            /* istanbul ignore next */
            return json.$id || `def-${i}`
          }
        }
      })

      app.register(SwaggerUI, {
        logLevel: 'warn',
        prefix: '/documentation'
      })

      const componentSchemas = prevOpenapiSchema.components?.schemas ?? {}
      for (const componentSchemaId of Object.keys(componentSchemas)) {
        const componentSchema = componentSchemas[componentSchemaId]
        app.addSchema({ $id: componentSchemaId, ...componentSchema })
      }

      if (prevVersionConfig.plugins) {
        await app.register(require(wrapperPath), prevVersionConfig.plugins)
      }

      for (const routeDiff of [...schemaDiff.deletedRoutes, ...schemaDiff.changedRoutes]) {
        const method = routeDiff.method.toUpperCase()
        const prevVersionPath = prevVersionPrefix + convertOpenApiToFastifyPath(routeDiff.path)

        const hasRouteMapper = app.hasRoute({ url: prevVersionPath, method })
        if (!hasRouteMapper) {
          app.log.warn(`Missing route ${method} "${prevVersionPath}" in the "${prevVersion}" API version`)
        }
      }

      const sameSchema = deepClone(prevNormalizedOpenapiSchema)
      for (const normalizedPath in sameSchema.paths ?? {}) {
        for (const method in sameSchema.paths[normalizedPath] ?? {}) {
          const prevVersionPath = prevVersionPrefix + convertOpenApiToFastifyPath(normalizedPath)
          const hasRouteMapper = app.hasRoute({
            url: prevVersionPath,
            method: method.toUpperCase()
          })

          const isSameRoute = schemaDiff.sameRoutes.find(
            routeDiff =>
              routeDiff.method === method.toLowerCase() &&
              routeDiff.path === normalizedPath
          )

          if (!isSameRoute || hasRouteMapper) {
            delete sameSchema.paths[normalizedPath][method]
          }
        }
        if (Object.keys(sameSchema.paths[normalizedPath]).length === 0) {
          delete sameSchema.paths[normalizedPath]
        }
      }

      if (Object.keys(sameSchema.paths).length > 0) {
        const versionPrefix = nextVersionPrefix

        await app.register(await import('fastify-openapi-glue'), {
          specification: sameSchema,
          operationResolver: (operationId, method) => {
            return {
              handler: async (req, reply) => {
                const prevVersionUrl = req.raw.url
                const nextVersionUrl = prevVersionUrl.replace(
                  prevVersionPrefix,
                  versionPrefix
                )

                const headers = req.headers
                delete headers.connection
                delete headers['content-length']
                delete headers['transfer-encoding']

                const res = await app.inject({
                  method: method.toUpperCase(),
                  url: nextVersionUrl,
                  headers,
                  payload: req.body
                })

                reply
                  .code(res.statusCode)
                  .headers(res.headers)
                  .send(res.body)
              }
            }
          }
        })
      }
    }, {
      name: prevVersion,
      encapsulate: true
    })

    await app.register(versionPlugin, {
      prefix: prevVersionPrefix
    })

    nextVersionPrefix = prevVersionPrefix
    nextNormalizedOpenapiSchema = prevNormalizedOpenapiSchema
  }
}

module.exports = fp(loadVersions)
