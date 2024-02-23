'use strict'

const { parseArgs } = require('node:util')
const { table, getBorderCharacters } = require('table')
const RuntimeApiClient = require('./runtime-api-client')

const tableColumns = [
  {
    value: 'id',
    alias: 'NAME'
  },
  {
    value: 'type',
    alias: 'TYPE'
  },
  {
    value: 'entrypoint',
    alias: 'ENTRYPOINT',
    formatter: (entrypoint) => {
      return entrypoint ? 'yes' : 'no'
    }
  }
]

const tableConfig = {
  border: getBorderCharacters('void'),
  columnDefault: {
    paddingLeft: 1,
    paddingRight: 1
  },
  drawHorizontalLine: () => false
}

async function printRuntimeServices (services) {
  const raws = [tableColumns.map(column => column.alias)]

  for (const service of services.services) {
    const raw = []
    for (const column of tableColumns) {
      let value = service[column.value]
      if (column.formatter) {
        value = column.formatter(value)
      }
      value ??= '-----'
      raw.push(value)
    }
    raws.push(raw)
  }

  const servicesTable = table(raws, tableConfig)
  console.log(servicesTable)
}

async function getRuntimeServicesCommand (argv) {
  const args = parseArgs({
    args: argv,
    options: {
      pid: { type: 'string', short: 'p' },
      name: { type: 'string', short: 'n' }
    },
    strict: false
  }).values

  const client = new RuntimeApiClient()
  const runtime = await client.getMatchingRuntime(args)

  const runtimeServices = await client.getRuntimeServices(runtime.pid)
  printRuntimeServices(runtimeServices)

  await client.close()
}

module.exports = getRuntimeServicesCommand
