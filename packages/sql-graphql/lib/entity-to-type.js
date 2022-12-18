'use strict'

const graphql = require('graphql')
const camelcase = require('camelcase')
const {
  sqlTypeToGraphQL,
  fromSelectionSet
} = require('./utils')

const ascDesc = new graphql.GraphQLEnumType({
  name: 'OrderByDirection',
  values: {
    ASC: { value: 'ASC' },
    DESC: { value: 'DESC' }
  }
})

const limitType = new graphql.GraphQLScalarType({
  name: 'LimitInt',
  description: 'Limit will be applied by default if not passed. If the provided value exceeds the maximum allowed value a validation error will be thrown'
})

function constructGraph (app, entity, opts, ignore) {
  const primaryKeys = Array.from(entity.primaryKeys).map((key) => camelcase(key))
  const relationalFields = entity.relations
    .map((relation) => relation.column_name)
  const entityName = entity.name
  const singular = entity.singularName
  const plural = entity.pluralName
  const {
    queryTopFields,
    mutationTopFields,
    resolvers,
    federationReplacements,
    federationMetadata,
    loaders
  } = opts

  const fields = {}

  for (const key of Object.keys(entity.fields)) {
    const field = entity.fields[key]
    if (ignore[field.camelcase]) {
      continue
    }

    const meta = { field }

    // sqlite doesn't support enums
    /* istanbul ignore next */
    if (field.enum) {
      const enumValues = field.enum.reduce((acc, enumValue) => {
        acc[enumValue] = { value: enumValue }
        return acc
      }, {})
      try {
        meta.type = new graphql.GraphQLEnumType({ name: key, values: enumValues })
      } catch (error) {
        console.error({ key, enumValues, entityName, table: entity.table, schema: entity.schema })
        throw new Error('Unable to generate GraphQLEnumType')
      }
    } else {
      meta.type = sqlTypeToGraphQL(field.sqlType)
    }
    if (field.primaryKey) {
      meta.primaryKeyType = field.type
      meta.type = graphql.GraphQLID
    } else if (field.foreignKey) {
      meta.type = graphql.GraphQLID
    }
    fields[field.camelcase] = meta
  }

  const type = new graphql.GraphQLObjectType({
    name: entityName,
    fields
  })

  resolvers.Query = resolvers.Query || {}
  resolvers.Mutation = resolvers.Mutation || {}
  loaders.Query = loaders.Query || {}

  const getBy = camelcase(['get', singular, ...(primaryKeys.map((key, i) => {
    if (i === 0) {
      return ['by', key]
    }
    return ['and', key]
  }).flat())].join('_'))

  const whereArgType = new graphql.GraphQLInputObjectType({
    name: `${entityName}WhereArguments`,
    fields: Object.keys(fields).reduce((acc, field) => {
      acc[field] = {
        type: new graphql.GraphQLInputObjectType({
          name: `${entityName}WhereArguments${field}`,
          fields: {
            eq: { type: fields[field].type },
            neq: { type: fields[field].type },
            gt: { type: fields[field].type },
            gte: { type: fields[field].type },
            lt: { type: fields[field].type },
            lte: { type: fields[field].type },
            like: { type: fields[field].type },
            in: { type: new graphql.GraphQLList(fields[field].type) },
            nin: { type: new graphql.GraphQLList(fields[field].type) }
          }
        })
      }
      return acc
    }, {})
  })

  queryTopFields[getBy] = {
    type,
    args: {
      ...(primaryKeys.reduce((acc, primaryKey) => {
        acc[primaryKey] = { type: new graphql.GraphQLNonNull(fields[primaryKey].type) }
        return acc
      }, {}))
    }
  }
  loaders.Query[getBy] = {
    loader (queries, ctx) {
      const keys = []
      for (const query of queries) {
        const pairs = []
        for (const key of primaryKeys) {
          pairs.push({ key, value: query.params[key] })
        }
        keys.push(pairs)
      }
      return loadMany(keys, queries, ctx)
    },
    opts: {
      cache: false
    }
  }

  const orderByFields = new graphql.GraphQLEnumType({
    name: `${entityName}OrderByField`,
    values: Object.keys(fields).reduce((acc, field) => {
      acc[field] = {
        value: field
      }
      return acc
    }, {})
  })
  queryTopFields[plural] = {
    type: new graphql.GraphQLList(type),
    args: {
      limit: { type: limitType },
      offset: { type: graphql.GraphQLInt },
      orderBy: {
        type: new graphql.GraphQLList(new graphql.GraphQLInputObjectType({
          name: `${entityName}OrderByArguments`,
          fields: {
            field: { type: orderByFields },
            direction: { type: new graphql.GraphQLNonNull(ascDesc) }
          }
        }))
      },
      where: { type: whereArgType }
    }
  }

  resolvers.Query[plural] = (_, query, ctx, info) => {
    const requestedFields = info.fieldNodes[0].selectionSet.selections.map((s) => s.name.value)
    for (const primaryKey of primaryKeys) {
      requestedFields.push(primaryKey)
    }
    return entity.find({ ...query, fields: [...requestedFields, ...relationalFields], ctx })
  }

  const inputType = new graphql.GraphQLInputObjectType({
    name: `${entityName}Input`,
    fields: Object.keys(fields).reduce((acc, field) => {
      const meta = fields[field]
      const actualField = meta.field
      if (!actualField.autoTimestamp) {
        acc[field] = meta
      }
      return acc
    }, {})
  })

  const count = camelcase(['count', plural])

  const countType = new graphql.GraphQLObjectType({
    name: `${plural}Count`,
    fields: {
      total: { type: graphql.GraphQLInt }
    }
  })

  queryTopFields[count] = {
    type: countType,
    args: {
      where: { type: whereArgType }
    }
  }

  resolvers.Query[count] = async (_, query, ctx, info) => {
    const requestedFields = info.fieldNodes[0].selectionSet.selections.map((s) => s.name.value)
    for (const primaryKey of primaryKeys) {
      requestedFields.push(primaryKey)
    }
    const total = await entity.count({ ...query, fields: [...requestedFields, ...relationalFields], ctx })
    return { total }
  }

  const save = camelcase(['save', singular])

  mutationTopFields[save] = {
    type,
    args: {
      input: { type: new graphql.GraphQLNonNull(inputType) }
    }
  }

  resolvers.Mutation[save] = async (_, { input }, ctx, info) => {
    const fields = fromSelectionSet(info.fieldNodes[0].selectionSet)
    return entity.save({ input, ctx, fields: [...fields, ...relationalFields] })
  }

  const insert = camelcase(['insert', plural])

  mutationTopFields[insert] = {
    type: new graphql.GraphQLList(type),
    args: {
      inputs: { type: new graphql.GraphQLNonNull(new graphql.GraphQLList(inputType)) }
    }
  }

  resolvers.Mutation[insert] = (_, { inputs }, ctx, info) => {
    const fields = fromSelectionSet(info.fieldNodes[0].selectionSet)
    return entity.insert({ inputs, ctx, fields: [...fields, ...relationalFields] })
  }

  const deleteKey = camelcase(['delete', plural])
  mutationTopFields[deleteKey] = {
    type: new graphql.GraphQLList(type),
    args: {
      where: { type: whereArgType }
    }
  }

  resolvers.Mutation[deleteKey] = (_, args, ctx, info) => {
    const fields = info.fieldNodes[0].selectionSet.selections.map((s) => s.name.value)
    return entity.delete({ ...args, fields: [...fields, ...relationalFields], ctx })
  }

  federationReplacements.push({
    find: new RegExp(`type ${entityName}`),
    replace: `type ${entityName} @key(fields: "${primaryKeys}")`
  })

  if (federationMetadata) {
    loaders[entityName] = loaders[entityName] || {}
    loaders[entityName].__resolveReference = {
      loader (queries, ctx) {
        const keys = []
        for (const { obj } of queries) {
          const pairs = []
          for (const key of primaryKeys) {
            pairs.push({ key, value: obj[key] })
          }
          keys.push(pairs)
        }
        return loadMany(keys, queries, ctx)
      },
      opts: {
        cache: false
      }
    }
  }

  return {
    type,
    entity,
    loadMany,
    getFields,
    relationalFields,
    fields
  }

  async function loadMany (keys, queries, ctx) {
    const fields = getFields(queries)

    // TODO this is inefficient as it might load
    // more data than needed if there are more than
    // one primary key
    const where = keys.reduce((acc, pairs) => {
      pairs.reduce((acc, { key, value }) => {
        if (acc[key]) {
          acc[key].in.push(value)
        } else {
          acc[key] = {
            in: [value]
          }
        }
        return acc
      }, acc)
      return acc
    }, {})

    const res = await entity.find({
      where,
      fields,
      ctx
    })

    const output = []
    // TODO this is extremely inefficient
    // we need a better data structure
    for (const pair of keys) {
      for (const row of res) {
        let target = row
        for (const { key, value } of pair) {
          if (row[key] !== value) {
            target = null
            break
          }
        }

        if (target) {
          output.push(target)
        }
      }
    }

    return output
  }

  function getFields (queries) {
    const fields = new Set([...relationalFields])
    for (const primaryKey of primaryKeys) {
      fields.add(primaryKey)
    }
    for (const query of queries) {
      fromSelectionSet(query.info.fieldNodes[0].selectionSet, fields)
    }
    fields.delete(undefined)
    return [...fields]
  }
}

module.exports = constructGraph
