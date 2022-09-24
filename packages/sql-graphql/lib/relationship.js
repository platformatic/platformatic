'use strict'

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
  for (const relation of relations) {
    assert(relation.table_name, 'table_name is required')
    assert(relation.foreign_table_name, 'foreign_table_name is required')

    const current = tablesTypeMap[relation.table_name]
    const foreign = tablesTypeMap[relation.foreign_table_name]
    assert(foreign !== undefined, `No foreign table named "${relation.foreign_table_name}" was found`)

    // current to foreign
    {
      const lowered = lowerCaseFirst(foreign.type)
      if (!relationships[current.type] || relationships[current.type][lowered] !== false) {
        current.fields[lowered] = { type: foreign.type }
        const originalField = camelcase(relation.column_name)
        delete current.fields[originalField]
        loaders[current.type] = resolvers[current.type] || {}
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
        resolvers[foreign.type][lowered] = async function (obj, args, ctx, info) {
          const fields = fromSelectionSet(info.fieldNodes[0].selectionSet, new Set())
          const relationalFields = current.entity.relations.map((relation) => relation.column_name)
          const toSearch = { ...args, fields: [...fields, ...relationalFields], ctx }
          toSearch.where = toSearch.where || {}
          toSearch.where[camelcase(relation.column_name)] = { eq: obj.id }
          return current.entity.find(toSearch)
        }
      }
    }
  }
}

function lowerCaseFirst (str) {
  str = str.toString()
  return str.charAt(0).toLowerCase() + str.slice(1)
}
