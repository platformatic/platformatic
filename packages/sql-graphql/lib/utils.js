import * as graphql from 'graphql'
import * as scalars from 'graphql-scalars'
import { GraphQLJSONObject } from 'graphql-type-json'
import { UnsupportedKindError } from './errors.js'

// The sqlTypeToGraphQL is shared between
// all database adapters.
export function sqlTypeToGraphQL (sqlType) {
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
      return graphql.GraphQLString
    case 'bigint':
      return graphql.GraphQLString
    case 'int2':
      return graphql.GraphQLInt
    case 'int4':
      return graphql.GraphQLInt
    case 'int8':
      return graphql.GraphQLString
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
      return graphql.GraphQLString
    case 'float4':
      return graphql.GraphQLFloat
    case 'date':
      return scalars.GraphQLDate
    case 'time':
      return scalars.GraphQLTime
    case 'timetz':
      return scalars.GraphQLTime
    case 'timestamp':
      return scalars.GraphQLDateTime
    case 'timestamptz':
      return scalars.GraphQLDateTime
    case 'uuid':
      return graphql.GraphQLID
    case 'json':
      return GraphQLJSONObject
    case 'jsonb':
      return GraphQLJSONObject
    default:
      return graphql.GraphQLString
  }
}

export function fromSelectionSet (selectionSet, fields = new Set()) {
  /* istanbul ignore next */
  for (const s of selectionSet.selections) {
    if (s.kind === 'Field') {
      fields.add(s.name.value)
    } else if (s.kind === 'InlineFragment') {
      fromSelectionSet(s.selectionSet, fields)
    } else {
      throw new UnsupportedKindError(s.kind)
    }
  }
  return fields
}

export const typeSym = Symbol.for('plt.sql-graphql.graphlType')
