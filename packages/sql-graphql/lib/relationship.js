'use strict'

/* eslint camelcase: 0 */

const camelcase = require('camelcase')
const {
  fromSelectionSet
} = require('./utils')
const assert = require('assert')

module.exports = function establishRelations (app, relations, resolvers, loaders, queryTopFields, relationships, metaMap) {
  const tablesTypeMap = {}
  const entities = app.platformatic.entities
  for (const key of Object.keys(entities)) {
    const entity = entities[key]
    tablesTypeMap[entity.table] = metaMap.get(entity)
  }
  for (const { table_name, foreign_table_name, column_name } of relations) {
    const enhanceAssertLogMsg = `(table: "${table_name}", foreign table: "${foreign_table_name}", column: "${column_name}")`

    assert(table_name, `table_name is required ${enhanceAssertLogMsg}`)
    assert(foreign_table_name, `foreign_table_name is required ${enhanceAssertLogMsg}`)
    assert(column_name.toLowerCase().endsWith('id'), `The column with id reference must be ended with "id" postfix ${enhanceAssertLogMsg}`)

    const current = tablesTypeMap[table_name]
    const foreign = tablesTypeMap[foreign_table_name]
    assert(foreign !== undefined, `No foreign table named "${foreign_table_name}" was found ${enhanceAssertLogMsg}`)

    // current to foreign
    {
      const lowered = lowerCaseFirst(camelcase(cutOutIdEnding(column_name)))
      if (!relationships[current.type] || relationships[current.type][lowered] !== false) {
        current.fields[lowered] = { type: foreign.type }
        const originalField = camelcase(column_name)
        delete current.fields[originalField]
        loaders[current.type] = loaders[current.type] || resolvers[current.type] || {}
        loaders[current.type][lowered] = {
          loader (queries, ctx) {
            const keys = queries.map(({ obj }) => {
              return obj[originalField]
            })
            return foreign.loadMany(keys, queries, ctx)
          },
          opts: {
            cache: false
          }
        }
      }
    }

    // foreign to current
    {
      const lowered = lowerCaseFirst(camelcase(current.entity.table))
      if (!relationships[foreign.type] || relationships[foreign.type][lowered] !== false) {
        foreign.fields[lowered] = queryTopFields[lowered]
        resolvers[foreign.type] = resolvers[foreign.type] || {}
        const resolveRelation = async function (obj, args, ctx, info) {
          const fields = fromSelectionSet(info.fieldNodes[0].selectionSet, new Set())
          const toSearch = { ...args, fields: [...fields, column_name], ctx }
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

function cutOutIdEnding (str) {
  str = str.toString()
  return str.slice(0, str.toLowerCase().lastIndexOf('id'))
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
