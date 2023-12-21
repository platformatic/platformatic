'use strict'

const { ServiceGenerator } = require('@platformatic/service/lib/generator/service-generator')
const { RuntimeGenerator } = require('./lib/generator/runtime-generator')
const { DBGenerator } = require('../db/lib/generator/db-generator')

async function main () {
  const firstService = new ServiceGenerator()
  const secondService = new DBGenerator()

  const rg = new RuntimeGenerator({
    targetDirectory: '/tmp/runtime',
    type: 'runtime'
  })

  firstService.setConfig({
    plugin: true,
    env: {
      SERVICE_1: 'foo'
    }
  })

  secondService.setConfig({
    connectionString: 'sqlite://./sqlite.db',
    env: {
      SERVICE_2: 'foo'
    }
  })
  rg.addService(firstService, 'first-service')
  rg.addService(secondService, 'second-service')

  rg.setEntryPoint('first-service')
  await rg.run()
}

main()
