// The most general way to get the connection info is through the driver.
// In this way, we don't need to do any assumptions about the connection string
// (with the exception of SQLite)
const getConnectionInfo = async (db, connectionString) => {
  let database, host, port, user
  if (db.isPg) {
    const driver = await db._pool.getConnection()
    const connectionParameters = driver.connection.client.connectionParameters
    host = connectionParameters.host
    port = connectionParameters.port
    database = connectionParameters.database
    user = connectionParameters.user
    driver.release()
  } else if (db.isMySql || db.isMariaDB || db.isMySql8) {
    const driver = await db._pool.getConnection()
    const connectionParameters = driver.connection.client.config
    database = connectionParameters.database
    host = connectionParameters.host
    port = connectionParameters.port
    user = connectionParameters.user
    driver.release()
  } else if (db.isSQLite) {
    database = connectionString?.split('sqlite://')[1]
  }

  return {
    database,
    host,
    port,
    user,
    isPg: db.isPg,
    isMySql: db.isMySql,
    isSQLite: db.isSQLite,
  }
}

module.exports = { getConnectionInfo }
