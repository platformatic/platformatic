export function wrapQuery (app, db, request) {
  const { startSpan, endSpan, SpanKind } = app.openTelemetry
  // Bind the query method to preserve the correct 'this' context for private class fields
  const originalQuery = db.query.bind(db)
  async function wrappedQuery () {
    const query = arguments[0]
    const connectionInfo = db.connectionInfo

    let namePrefix
    if (connectionInfo.isPg) {
      namePrefix = 'pg.query:'
    } else if (connectionInfo.isMySql) {
      namePrefix = 'mysql.query:'
    } else if (connectionInfo.isSQLite) {
      namePrefix = 'sqlite.query:'
    } else {
      namePrefix = 'db.query:'
    }

    const format = {
      escapeIdentifier: str => str,
      formatValue: (value, index) => ({ placeholder: `$${index + 1}`, value })
    }
    const { text: queryText } = query.format(format)
    // We get the name form the first 20 characters of the query
    // The spane name is not really important, all the info (included the full query) are in the attributes)
    const name = queryText.substring(0, 20)
    const spanName = `${namePrefix}${name.replace(/\n|\r/g, ' ')}`

    // Pass undefined to let startSpan use the active context from OpenTelemetry
    const ctx = undefined

    const { database, host, port, user, dbSystem } = connectionInfo
    const telemetryAttributes = {
      'db.statement': queryText,
      'db.system': dbSystem,
      'db.name': database
    }

    if (!db.isSQLite) {
      // we dont' set the connection string as property because it can contain the password
      telemetryAttributes['db.user'] = user
      telemetryAttributes['net.peer.name'] = host
      telemetryAttributes['net.peer.port'] = port
    }

    let span
    try {
      span = startSpan(spanName, ctx, telemetryAttributes, SpanKind.CLIENT)
      // Call the bound query method with the original arguments
      const result = await originalQuery(...arguments)
      endSpan(span)
      return result
    } catch (err) /* istanbul ignore next */ {
      endSpan(span, err)
      throw err
    }
  }
  return wrappedQuery
}

export function wrapDB (app, db, request) {
  const newDb = Object.create(db)
  const connectionInfo = db.connectionInfo
  newDb.query = wrapQuery(app, db, request)
  if (typeof db.tx === 'function') {
    newDb.tx = function wrappedTx (func) {
      return db.tx(txDb => {
        txDb.connectionInfo = connectionInfo
        const _newDb = Object.create(txDb)
        _newDb.query = wrapQuery(app, txDb, request)
        return func(_newDb)
      })
    }
  }
  return newDb
}

export function setupTelemetry (app) {
  // Decorate the request with the wrapped DB.
  // We need that for the queries written directly using `db`
  if (app.platformatic.db) {
    app.decorateRequest('getDB', function getDB () {
      return wrapDB(app, app.platformatic.db, this)
    })
  }
}
