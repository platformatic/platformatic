// The most general way to get the connection info is through the driver.
// In this way, we don't need to do any assumptions about the connection string
// (with the exception of SQLite)
export async function getConnectionInfo (db, connectionString) {
  let database, host, port, user
  let dbSystem = 'unknown'
  if (db.isPg) {
    const driver = await db._pool.getConnection()
    const connectionParameters = driver.connection.client.connectionParameters
    host = connectionParameters.host
    port = connectionParameters.port
    database = connectionParameters.database
    user = connectionParameters.user
    dbSystem = 'postgresql'
    driver.release()
  } else if (db.isMySql || db.isMariaDB || db.isMySql8) {
    const driver = await db._pool.getConnection()
    const connectionParameters = driver.connection.client.config
    database = connectionParameters.database
    host = connectionParameters.host
    port = connectionParameters.port
    user = connectionParameters.user
    dbSystem = 'mysql'
    driver.release()
  } else if (db.isSQLite) {
    dbSystem = 'sqlite'
    database = connectionString?.split('sqlite://')[1]
  }

  return {
    database,
    host,
    port,
    user,
    isPg: !!db.isPg,
    isMySql: !!db.isMySql,
    isSQLite: !!db.isSQLite,
    dbSystem
  }
}
