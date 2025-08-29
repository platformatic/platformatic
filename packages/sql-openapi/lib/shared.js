import { mapSQLTypeToOpenAPIType } from '@platformatic/sql-json-schema-mapper'
import { buildCursorUtils } from './cursor.js'

export function generateArgs (entity, ignore) {
  const sortedEntityFields = Object.keys(entity.fields).sort()

  const whereArgs = sortedEntityFields.reduce((acc, name) => {
    if (ignore[name]) {
      return acc
    }
    const field = entity.fields[name]
    const baseKey = `where.${field.camelcase}.`
    /* istanbul ignore next */
    if (field.isArray) {
      for (const modifier of ['all', 'any']) {
        const key = baseKey + modifier
        acc[key] = { type: mapSQLTypeToOpenAPIType(field.sqlType) }
      }
    } else {
      for (const modifier of ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike']) {
        const key = baseKey + modifier
        acc[key] = { type: mapSQLTypeToOpenAPIType(field.sqlType), enum: field.enum }
      }

      for (const modifier of ['in', 'nin', 'contains', 'contained', 'overlaps']) {
        const key = baseKey + modifier
        acc[key] = { type: 'string' }
      }
    }

    return acc
  }, {})

  const orderByArgs = sortedEntityFields.reduce((acc, name) => {
    const field = entity.fields[name]

    if (ignore[name] || field.isArray) {
      return acc
    }
    const key = `orderby.${field.camelcase}`
    acc[key] = { type: 'string', enum: ['asc', 'desc'] }
    return acc
  }, {})

  // NOTE: probably not the best way to do this but it works for now
  // TODO: when OpenAPI supports nested objects in querystring this should be changed
  const whereOrArrayArgs = {
    'where.or': {
      type: 'array',
      items: {
        type: 'string'
      }
    }
  }

  Object.assign(whereArgs, whereOrArrayArgs)

  return { whereArgs, orderByArgs }
}

export function rootEntityRoutes (
  app,
  entity,
  whereArgs,
  orderByArgs,
  entityLinks,
  entitySchema,
  fields,
  entitySchemaInput,
  ignoreRoutes
) {
  const ignoredGETRoute = ignoreRoutes.find(ignoreRoutes => {
    return ignoreRoutes.path === app.prefix && ignoreRoutes.method === 'GET'
  })

  if (!ignoredGETRoute) {
    const { buildCursorHeaders, transformQueryToCursor } = buildCursorUtils(app, entity)

    app.get(
      '/',
      {
        schema: {
          operationId: 'get' + capitalize(entity.pluralName),
          summary: `Get ${entity.pluralName}.`,
          description: `Fetch ${entity.pluralName} from the database.`,
          tags: [entity.table],
          querystring: {
            type: 'object',
            properties: {
              limit: {
                type: 'integer',
                description:
                  'Limit will be applied by default if not passed. If the provided value exceeds the maximum allowed value a validation error will be thrown'
              },
              offset: { type: 'integer' },
              totalCount: { type: 'boolean', default: false },
              cursor: {
                type: 'boolean',
                default: false,
                description: 'Include cursor headers in response. Cursor keys built from orderBy clause'
              },
              startAfter: {
                type: 'string',
                description: 'Cursor for forward pagination. List objects after this cursor position',
                format: 'byte'
              },
              endBefore: {
                type: 'string',
                description: 'Cursor for backward pagination. List objects before this cursor position',
                format: 'byte'
              },
              fields,
              ...whereArgs,
              ...orderByArgs
            },
            additionalProperties: false
          },
          response: {
            200: {
              type: 'array',
              items: entitySchema
            }
          }
        }
      },
      async function (request, reply) {
        const query = request.query
        const { limit, offset, fields, startAfter, endBefore } = query
        const queryKeys = Object.keys(query)
        const where = {}
        const orderBy = []

        for (let i = 0; i < queryKeys.length; i++) {
          const key = queryKeys[i]
          if (key.startsWith('where.or')) {
            const orParam = query[key][0]
            // NOTE: Remove the first and last character which are the brackets
            // each or condition is separated by a pipe '|'
            // the conditions inside the or statement are the same as it would normally be in the where statement
            // except that the field name is not prefixed with 'where.'
            // e.g. where.or=(name.eq=foo|name.eq=bar)
            // e.g. where.or=(name.eq=foo|name.eq=bar|name.eq=baz)
            //
            // Also, the or statement supports in and nin operators
            // e.g. where.or=(name.in=foo,bar|name.eq=baz)
            const parsed = orParam
              .substring(1, orParam.length - 1)
              .split('|')
              .map(v => v.split('='))
              .reduce((acc, [k, v]) => {
                const [field, modifier] = k.split('.')
                if (modifier === 'in' || modifier === 'nin') {
                  // TODO handle escaping of ,
                  v = v.split(',')
                  /* istanbul ignore next */
                  if (mapSQLTypeToOpenAPIType(entity.camelCasedFields[field].sqlType) === 'integer') {
                    v = v.map(v => parseInt(v))
                  }
                }
                acc.push({ [field]: { [modifier]: parseNullableValue(field, v) } })
                return acc
              }, [])
            where.or = parsed
            continue
          }

          if (key.startsWith('where.')) {
            const [, field, modifier] = key.split('.')
            where[field] ||= {}
            let value = query[key]
            if (modifier === 'in' || modifier === 'nin') {
              // TODO handle escaping of ,
              value = query[key].split(',')
              if (mapSQLTypeToOpenAPIType(entity.camelCasedFields[field].sqlType) === 'integer') {
                value = value.map(v => parseInt(v))
              }
            }

            where[field][modifier] = parseNullableValue(field, value)
          } else if (key.startsWith('orderby.')) {
            const [, field] = key.split('.')
            orderBy[field] ||= {}
            orderBy.push({ field, direction: query[key] })
          }
        }

        const ctx = { app: this, reply }
        const { cursor, nextPage } = transformQueryToCursor({ startAfter, endBefore })
        const res = await entity.find({ limit, offset, fields, orderBy, where, ctx, cursor, nextPage })

        // X-Total-Count header
        if (query.totalCount) {
          let totalCount
          if (((offset ?? 0) === 0 || res.length > 0) && limit !== undefined && res.length < limit) {
            totalCount = (offset ?? 0) + res.length
          } else {
            totalCount = await entity.count({ where, ctx })
          }
          reply.header('X-Total-Count', totalCount)
        }

        // cursor headers
        if ((query.cursor || startAfter || endBefore) && res.length > 0) {
          const { startAfter, endBefore } = buildCursorHeaders({
            findResult: res,
            orderBy,
            primaryKeys: entity.primaryKeys
          })
          reply.header('X-Start-After', startAfter)
          reply.header('X-End-Before', endBefore)
        }

        return res
      }
    )
  }

  const ignoredPOSTRoute = ignoreRoutes.find(ignoreRoute => {
    return ignoreRoute.path === app.prefix && ignoreRoute.method === 'POST'
  })

  if (!ignoredPOSTRoute) {
    app.post(
      '/',
      {
        schema: {
          operationId: 'create' + capitalize(entity.singularName),
          summary: `Create ${entity.singularName}.`,
          description: `Add new ${entity.singularName} to the database.`,
          body: entitySchemaInput,
          tags: [entity.table],
          querystring: {
            type: 'object',
            properties: {
              fields
            },
            additionalProperties: false
          },
          response: {
            200: entitySchema
          }
        },
        links: {
          200: entityLinks
        }
      },
      async function (request, reply) {
        const { fields } = request.query
        const ctx = { app: this, reply }

        let queryFields
        if (fields) {
          queryFields = [...fields]
          for (const key of entity.primaryKeys.values()) {
            if (!fields.includes(key)) {
              queryFields.push(key)
            }
          }
        }

        const res = await entity.save({ input: request.body, ctx, fields: queryFields })

        reply.header('location', `${app.prefix}/${res[[...entity.primaryKeys][0]]}`)

        if (fields) {
          for (const key of entity.primaryKeys.values()) {
            if (!fields.includes(key)) {
              delete res[key]
            }
          }
        }

        return res
      }
    )
  }

  const parseNullableValue = (field, value) => {
    const fieldIsNullable = entity.camelCasedFields[field].isNullable
    if (fieldIsNullable && typeof value === 'string' && value.toLowerCase() === 'null') {
      return null
    } else {
      return value
    }
  }

  const ignoredPUTRoute = ignoreRoutes.find(ignoreRoute => {
    return ignoreRoute.path === app.prefix && ignoreRoute.method === 'PUT'
  })
  if (!ignoredPUTRoute) {
    app.put('/', {
      schema: {
        operationId: 'update' + capitalize(entity.pluralName),
        summary: `Update ${entity.pluralName}.`,
        description: `Update one or more ${entity.pluralName} in the database.`,
        body: entitySchemaInput,
        tags: [entity.table],
        querystring: {
          type: 'object',
          properties: {
            fields,
            ...whereArgs
          },
          additionalProperties: false
        },
        response: {
          200: {
            type: 'array',
            items: entitySchema
          }
        }
      },
      links: {
        200: entityLinks
      },
      async handler (request, reply) {
        const ctx = { app: this, reply }
        const query = request.query
        const queryKeys = Object.keys(query)
        const where = {}

        for (let i = 0; i < queryKeys.length; i++) {
          const key = queryKeys[i]
          if (key.startsWith('where.')) {
            const [, field, modifier] = key.split('.')
            where[field] ||= {}
            let value = query[key]
            if (modifier === 'in' || modifier === 'nin') {
              // TODO handle escaping of ,
              value = query[key].split(',')
              if (mapSQLTypeToOpenAPIType(entity.camelCasedFields[field].sqlType) === 'integer') {
                value = value.map(v => parseInt(v))
              }
            }
            where[field][modifier] = parseNullableValue(field, value)
          }
        }

        const res = await entity.updateMany({
          input: {
            ...request.body
          },
          where,
          fields: request.query.fields,
          ctx
        })
        // TODO: Should find a way to test this line
        // if (!res) return reply.callNotFound()
        reply.header('location', `${app.prefix}`)
        return res
      }
    })
  }
}

export function capitalize (str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function getFieldsForEntity (entity, ignore) {
  return {
    type: 'array',
    items: {
      type: 'string',
      enum: Object.keys(entity.fields)
        .map(field => entity.fields[field].camelcase)
        .filter(field => !ignore[field])
        .sort()
    }
  }
}
