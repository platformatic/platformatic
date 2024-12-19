'use strict'

const express = require('express')
const migrate = require('./migrate.js')
const pg = require('pg')
const { Pool } = pg

const connectionString = 'postgresql://postgres:postgres@127.0.0.1:5432/test-telemetry-pg'

const main = async () => {
  await migrate(connectionString)
  const pool = new Pool({ connectionString })
  const app = express()
  app.use(express.json())
  app.use('/users', require('./routes/users')(pool))

  // ...and of the DB connection
  globalThis.platformatic.setConnectionString(connectionString)

  app.listen(1)
}

main()
