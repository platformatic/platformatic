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

function constructGraph (app, entity, opts) {
  const primaryKey = camelcase(entity.primaryKey)
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
    const meta = { field }
    meta.type = sqlTypeToGraphQL(field.sqlType)
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

  const getBy = camelcase(['get', singular, 'by', primaryKey])

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
      [primaryKey]: { type: new graphql.GraphQLNonNull(fields[primaryKey].type) }
    }
  }
  loaders.Query[getBy] = {
    loader (queries, ctx) {
      const keys = []
      for (const query of queries) {
        keys.push(query.params[primaryKey])
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
      limit: { type: graphql.GraphQLInt },
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
    requestedFields.push(primaryKey)
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
    replace: `type ${entityName} @key(fields: "${primaryKey}")`
  })

  if (federationMetadata) {
    loaders[entityName] = loaders[entityName] || {}
    loaders[entityName].__resolveReference = {
      loader (queries, ctx) {
        const keys = queries.map(({ obj }) => obj[primaryKey])
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
    fields
  }

  async function loadMany (keys, queries, ctx) {
    const fields = getFields(queries)
    const res = await entity.find({
      where: {
        [primaryKey]: {
          in: keys
        }
      },
      fields,
      ctx
    })

    const map = {}

    for (const row of res) {
      map[row[primaryKey]] = row
    }

    const output = []
    for (const key of keys) {
      output.push(map[key])
    }

    return output
  }

  function getFields (queries) {
    const fields = new Set([...relationalFields])
    fields.add(primaryKey)
    for (const query of queries) {
      fromSelectionSet(query.info.fieldNodes[0].selectionSet, fields)
    }
    fields.delete(undefined)
    return [...fields]
  }
}

module.exports = constructGraph
