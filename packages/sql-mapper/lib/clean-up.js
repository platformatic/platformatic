'use strict'

const { tableName } = require('./utils')
const { Sorter } = require('@hapi/topo')

function buildCleanUp (db, sql, logger, entities) {
  return async function cleanUp () {
    logger.trace('cleaning up')
    await db.tx(async tx => {
      const topo = new Sorter()
      const lookup = new Map()

      for (const entity of Object.values(entities)) {
        /* istanbul ignore next */
        const relations = entity.relations.map(relation => {
          // there is a name clash here with tables with the
          // same name in different schemas
          return relation.foreign_table_name
        })
        lookup.set(entity.table, entity)

        const name = entity.table

        topo.add(name, { before: relations, group: name })
      }

      for (const name of topo.nodes) {
        const entity = lookup.get(name)
        const toDelete = tableName(sql, entity.table, entity.schema)
        await tx.query(sql`DELETE FROM ${toDelete}`)
      }
    })
  }
}

module.exports = buildCleanUp
