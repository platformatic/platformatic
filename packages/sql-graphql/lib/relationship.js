'use strict'

/* eslint camelcase: 0 */

const camelcase = require('camelcase')
const {
  fromSelectionSet
} = require('./utils')
const assert = require('assert')

module.exports = function establishRelations (app, relations, resolvers, loaders, queryTopFields, relationships, metaMap) {
  const entitiesTypeMap = {}
  const entities = app.platformatic.entities
  for (const key of Object.keys(entities)) {
    entitiesTypeMap[key] = metaMap.get(entities[key])
  }
  for (const relation of relations) {
    const { table_name, foreign_table_name, column_name, foreign_column_name, entityName, foreignEntityName, loweredTableWithSchemaName } = relation
    const enhanceAssertLogMsg = `(table: "${table_name}", foreign table: "${foreign_table_name}", column: "${column_name}")`

    assert(table_name, `table_name is required ${enhanceAssertLogMsg}`)
    assert(foreign_table_name, `foreign_table_name is required ${enhanceAssertLogMsg}`)

    const current = entitiesTypeMap[entityName]
    const foreign = entitiesTypeMap[foreignEntityName]
    assert(foreign !== undefined, `No foreign table named "${foreign_table_name}" was found ${enhanceAssertLogMsg}`)

    // current to foreign, we skip this if the foreign table has a composite primary key
    // TODO implement support for this case
    /* istanbul ignore else */
    if (foreign.entity.primaryKeys.size === 1) {
      const lowered = generateRelationshipName(column_name, foreign)
      if (!relationships[current.type] || relationships[current.type][lowered] !== false) {
        const originalField = camelcase(column_name)
        delete current.fields[originalField]
        current.fields[lowered] = { type: foreign.type }
        loaders[current.type] = loaders[current.type] || resolvers[current.type] || {}
        const key = camelcase(foreign_column_name)
        loaders[current.type][lowered] = {
          loader (queries, ctx) {
            const keys = []
            for (const { obj } of queries) {
              keys.push([{ key, value: obj[originalField].toString() }])
            }
            return foreign.loadMany(keys, queries, ctx)
          },
          opts: {
            cache: false
          }
        }
      }
    }

    // foreign to current, we skip this if the current table has a composite primary key
    // TODO implement support for this case
    if (current.entity.primaryKeys.size === 1) {
      const lowered = loweredTableWithSchemaName
      if (!relationships[foreign.type] || relationships[foreign.type][lowered] !== false) {
        foreign.fields[lowered] = queryTopFields[lowered]
        resolvers[foreign.type] = resolvers[foreign.type] || {}
        const resolveRelation = async function (obj, args, ctx, info) {
          const fields = fromSelectionSet(info.fieldNodes[0].selectionSet, new Set())
          const toSearch = { ...args, fields: [...fields, column_name, ...current.relationalFields], ctx }
          toSearch.where = toSearch.where || {}
          toSearch.where[camelcase(column_name)] = { eq: obj.id }
          return current.entity.find(toSearch)
        }
        if (resolvers[foreign.type][lowered] === undefined) {
          resolvers[foreign.type][lowered] = resolveRelation
        } else {
          const previousResolve = resolvers[foreign.type][lowered]
          resolvers[foreign.type][lowered] = async function (obj, args, ctx, info) {
            const previousResponse = await previousResolve(obj, args, ctx, info)
            const currentResponse = await resolveRelation(obj, args, ctx, info)
            return uniqueBy([...previousResponse, ...currentResponse], findPrimaryColumnName(current.entity.camelCasedFields))
          }
        }
      }
    }
  }
}

function lowerCaseFirst (str) {
  str = str.toString()
  return str.charAt(0).toLowerCase() + str.slice(1)
}

function generateRelationshipName (str, foreign) {
  const primaryKey = foreign.entity.primaryKeys.values().next().value
  str = str.toString()
  if (str.endsWith('_' + primaryKey)) {
    str = str.slice(0, -2)
  }
  return lowerCaseFirst(camelcase(str))
}

function findPrimaryColumnName (camelCasedFields) {
  return Object.entries(camelCasedFields).find(([, options]) => options.primaryKey)[0]
}

function unique (arr) {
  return [...new Set(arr)]
}

function uniqueBy (arr, key) {
  const uniqueValues = unique(arr.map(el => el[key]))
  return uniqueValues.map(value => arr.find(el => el[key] === value))
};
