'use strict'

const graphql = require('graphql')
const scalars = require('graphql-scalars')
const { GraphQLJSONObject } = require('graphql-type-json')

// The sqlTypeToGraphQL is shared between
// all database adapters.
function sqlTypeToGraphQL (sqlType) {
  // TODO support more types
  /* istanbul ignore next */
  switch (sqlType) {
    case 'int':
      return graphql.GraphQLInt
    case 'integer':
      return graphql.GraphQLInt
    case 'tinyint':
      return graphql.GraphQLBoolean
    case 'smallint':
      return graphql.GraphQLInt
    case 'decimal':
      return graphql.GraphQLInt
    case 'bigint':
      return graphql.GraphQLInt
    case 'int2':
      return graphql.GraphQLInt
    case 'int4':
      return graphql.GraphQLInt
    case 'varchar':
      return graphql.GraphQLString
    case 'text':
      return graphql.GraphQLString
    case 'bool':
      return graphql.GraphQLBoolean
    case 'real':
      return graphql.GraphQLFloat
    case 'float8':
      return graphql.GraphQLFloat
    case 'double':
      return graphql.GraphQLFloat
    case 'double precision':
      return graphql.GraphQLFloat
    case 'numeric':
      return graphql.GraphQLFloat
    case 'float4':
      return graphql.GraphQLFloat
    case 'date':
      return scalars.GraphQLDate
    case 'time':
      return graphql.GraphQLString
    case 'timestamp':
      return scalars.GraphQLDateTime
    case 'uuid':
      return graphql.GraphQLString
    case 'json':
      return GraphQLJSONObject
    case 'jsonb':
      return GraphQLJSONObject
    default:
      return graphql.GraphQLString
  }
}

function fromSelectionSet (selectionSet, fields = new Set()) {
  /* istanbul ignore next */
  for (const s of selectionSet.selections) {
    if (s.kind === 'Field') {
      fields.add(s.name.value)
    } else if (s.kind === 'InlineFragment') {
      fromSelectionSet(s.selectionSet, fields)
    } else {
      throw new Error('Unsupported kind: ' + s.kind)
    }
  }
  return fields
}

module.exports = {
  sqlTypeToGraphQL,
  fromSelectionSet,
  typeSym: Symbol('graphlType')
}
