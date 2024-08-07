'use strict'

function wrapQuery (app, db, request) {
  const { startSpan, endSpan, SpanKind } = app.openTelemetry
  async function wrappedQuery () {
    const query = arguments[0]

    let namePrefix, dbSystem
    if (db.isPg) {
      namePrefix = 'pg.query:'
      dbSystem = 'postgresql'
    } else if (db.isMySql) {
      namePrefix = 'mysql.query:'
      dbSystem = 'mysql'
    } else if (db.isMariaDB) {
      namePrefix = 'mariadb.query:'
      dbSystem = 'mysql'
    } else if (db.isSQLite) {
      namePrefix = 'sqlite.query:'
      dbSystem = 'sqlite'
    } else {
      namePrefix = 'db.query:'
      dbSystem = 'unknown'
    }

    const format = {
      escapeIdentifier: (str) => (str),
      formatValue: (value, index) => ({ placeholder: `$${index + 1}`, value }),
    }
    const { text: queryText } = query.format(format)
    const spanName = `${namePrefix}${queryText.replace(/\n|\r/g, '')}`

    const ctx = request.span?.context

    const telemetryAttributes = {
      'db.statement': queryText,
      'db.system': dbSystem,
    }

    let span
    try {
      span = startSpan(spanName, ctx, telemetryAttributes, SpanKind.CLIENT)
      const result = await db.query.apply(db, arguments)
      endSpan(span)
      return result
    } catch (err) /* istanbul ignore next */ {
      endSpan(span, err)
      throw err
    }
  }
  return wrappedQuery
}

function wrapDB (app, db, request) {
  const newDb = Object.create(db)
  newDb.query = wrapQuery(app, db, request)
  newDb.tx = function wrappedTx (func) {
    return db.tx((db) => {
      const _newDb = Object.create(db)
      _newDb.query = wrapQuery(app, db, request)
      return func(_newDb)
    })
  }
  return newDb
}

const setupTelemetry = app => {
  // Decorate the request with the wrapped DB.
  // We need that for the queries written directly using `db`
  if (app.platformatic.db) {
    app.decorateRequest('getDB', function getDB () {
      return wrapDB(app, app.platformatic.db, this)
    })
  }
}

module.exports = {
  setupTelemetry,
  wrapDB,
}
