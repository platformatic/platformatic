'use strict'

const { mapSQLTypeToOpenAPIType } = require('@platformatic/sql-json-schema-mapper')
const camelcase = require('camelcase')
const { generateArgs, capitalize, getFieldsForEntity, rootEntityRoutes } = require('./shared')

async function entityPlugin (app, opts) {
  const entity = opts.entity
  const ignore = opts.ignore

  const entitySchema = {
    $ref: entity.name + '#'
  }

  const entitySchemaInput = {
    $ref: entity.name + 'Input#'
  }
  const primaryKeysParams = getPrimaryKeysParams(entity)
  const primaryKeysCamelcase = Array.from(entity.primaryKeys).map((key) => camelcase(key))

  const { whereArgs, orderByArgs } = generateArgs(entity, ignore)

  const fields = getFieldsForEntity(entity, ignore)

  rootEntityRoutes(app, entity, whereArgs, orderByArgs, undefined, entitySchema, fields, entitySchemaInput)

  let pathWithParams = ''

  for (const key of entity.primaryKeys) {
    const camelcaseKey = camelcase(key)
    const relation = entity.relations.find((relation) => relation.column_name === key)
    if (relation) {
      pathWithParams += `/${relation.foreignEntityName}/:${camelcaseKey}`
    } else {
      pathWithParams += `/${camelcaseKey}/:${camelcaseKey}`
    }
  }

  const operationName = primaryKeysCamelcase.reduce((acc, key) => {
    if (acc !== '') {
      acc += 'And'
    }
    return acc + capitalize(key)
  }, '')

  app.get(pathWithParams, {
    schema: {
      operationId: `get${entity.name}By${operationName}`,
      params: primaryKeysParams,
      tags: [entity.table],
      querystring: {
        type: 'object',
        properties: {
          fields
        }
      },
      response: {
        200: entitySchema
      }
    }
  }, async function (request, reply) {
    const ctx = { app: this, reply }
    const res = await entity.find({
      ctx,
      where: primaryKeysCamelcase.reduce((acc, key) => {
        acc[key] = { eq: request.params[key] }
        return acc
      }, {}),
      fields: request.query.fields
    })
    if (res.length === 0) {
      return reply.callNotFound()
    }
    return res[0]
  })

  for (const method of ['POST', 'PUT']) {
    app.route({
      url: pathWithParams,
      method,
      schema: {
        body: entitySchemaInput,
        params: primaryKeysParams,
        tags: [entity.table],
        querystring: {
          type: 'object',
          properties: {
            fields
          }
        },
        response: {
          200: entitySchema
        }
      },
      async handler (request, reply) {
        const ids = primaryKeysCamelcase.map((key) => { return { key, value: request.params[key] } })
        const ctx = { app: this, reply }
        const res = await entity.save({
          ctx,
          input: {
            ...request.body,
            ...(ids.reduce((acc, { key, value }) => {
              acc[key] = value
              return acc
            }, {}))
          },
          where: ids.reduce((acc, { key, value }) => {
            acc[key] = { eq: value }
            return acc
          }, {}),
          fields: request.query.fields
        })
        let location = app.prefix + pathWithParams
        for (const key of primaryKeysCamelcase) {
          location = location.replace(`:${key}`, request.params[key])
        }
        reply.header('location', location)
        return res
      }
    })
  }

  app.delete(pathWithParams, {
    schema: {
      params: primaryKeysParams,
      tags: [entity.table],
      querystring: {
        type: 'object',
        properties: {
          fields
        }
      },
      response: {
        200: entitySchema
      }
    }
  }, async function (request, reply) {
    const ids = primaryKeysCamelcase.map((key) => { return { key, value: request.params[key] } })
    const ctx = { app: this, reply }
    const res = await entity.delete({
      ctx,
      where: ids.reduce((acc, { key, value }) => {
        acc[key] = { eq: value }
        return acc
      }, {}),
      fields: request.query.fields
    })
    if (res.length === 0) {
      return reply.callNotFound()
    }
    return res[0]
  })
}

function getPrimaryKeysParams (entity) {
  const properties = {}
  const primaryKeys = entity.primaryKeys
  const fields = entity.fields
  const required = []
  for (const key of primaryKeys) {
    const field = fields[key]
    properties[field.camelcase] = { type: mapSQLTypeToOpenAPIType(field.sqlType) }
    required.push(field.camelcase)
  }

  return {
    type: 'object',
    properties,
    required
  }
}

module.exports = entityPlugin
